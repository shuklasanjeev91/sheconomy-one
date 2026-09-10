import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { EgressClient, EncodedFileOutput, EncodedFileType } from 'npm:livekit-server-sdk@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  extractEgressFileInfo,
  mapEgressStatusToRecordingStatus,
} from '../_shared/recording-helpers.ts'
import { readEgressS3Config } from '../_shared/s3-sign.ts'

type Action = 'start' | 'stop' | 'status' | 'reconcile' | 'check'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('LIVEKIT_API_KEY')
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
    const livekitUrl = Deno.env.get('LIVEKIT_URL')

    if (!apiKey || !apiSecret || !livekitUrl) {
      return jsonResponse(
        {
          ok: false,
          error: 'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.',
        },
        500,
      )
    }

    // `check` is a lightweight probe — returns whether S3 recording storage is
    // ready so the client can show or hide the Record button early.
    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? '') as Action

    if (action === 'check') {
      const s3 = readEgressS3Config()
      return jsonResponse({ ok: true, recordingConfigured: !!s3 })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    const meetingId = String(body.meetingId ?? '')
    const roomName = String(body.roomName ?? '')
    const recordingId = body.recordingId ? String(body.recordingId) : undefined

    if (!meetingId || !['start', 'stop', 'status', 'reconcile'].includes(action)) {
      return jsonResponse({ ok: false, error: 'Invalid request.' }, 400)
    }

    if ((action === 'start' || action === 'stop') && !roomName) {
      return jsonResponse({ ok: false, error: 'roomName is required.' }, 400)
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, host_id, room_id, status')
      .eq('id', meetingId)
      .maybeSingle()

    if (meetingError || !meeting) {
      return jsonResponse({ ok: false, error: 'Meeting not found.' }, 404)
    }

    if (meeting.host_id !== authData.user.id) {
      return jsonResponse({ ok: false, error: 'Only the host can control recording.' }, 403)
    }

    if (roomName && meeting.room_id !== roomName) {
      return jsonResponse({ ok: false, error: 'Invalid room.' }, 403)
    }

    const egress = new EgressClient(livekitUrl, apiKey, apiSecret)

    // ── status / reconcile ────────────────────────────────────────────────────
    if (action === 'status' || action === 'reconcile') {
      const targetId = recordingId
      let query = serviceSupabase
        .from('meeting_recordings')
        .select(
          'id, meeting_id, host_id, status, recording_sid, recording_url, storage_path, duration_seconds, file_size_bytes, error_message, share_token_hash, share_created_at, share_revoked_at, started_at, ended_at, created_at, updated_at',
        )
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false })

      if (targetId) {
        query = query.eq('id', targetId)
      }

      const { data: rows, error: listError } = await query.limit(targetId ? 1 : 20)
      if (listError) {
        return jsonResponse({ ok: false, error: 'Could not load recordings.' }, 500)
      }

      const recordings = []
      for (const row of rows ?? []) {
        let next = row
        if (
          action === 'reconcile' &&
          row.recording_sid &&
          ['starting', 'recording', 'processing'].includes(row.status)
        ) {
          next = await reconcileEgressRow(serviceSupabase, egress, row)
        }
        recordings.push(sanitizeRecording(next))
      }

      return jsonResponse({
        ok: true,
        recording: recordings[0] ?? null,
        recordings,
      })
    }

    // ── start ─────────────────────────────────────────────────────────────────
    if (action === 'start') {
      if (meeting.status === 'ended') {
        return jsonResponse({ ok: false, error: 'Meeting has ended.' }, 400)
      }

      const s3 = readEgressS3Config()
      if (!s3) {
        return jsonResponse(
          {
            ok: false,
            error: 'Recording storage is not configured. Add S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY as Edge Function secrets in the Supabase dashboard.',
            configRequired: true,
          },
          503,
        )
      }

      // Check for an already-active recording (idempotent start).
      const { data: active } = await serviceSupabase
        .from('meeting_recordings')
        .select('id, status, recording_sid')
        .eq('meeting_id', meetingId)
        .in('status', ['starting', 'recording'])
        .maybeSingle()

      if (active) {
        return jsonResponse({
          ok: true,
          recordingId: active.id,
          recordingSid: active.recording_sid ?? undefined,
          status: active.status,
          alreadyActive: true,
        })
      }

      const storagePath = `meetings/${meetingId}/${crypto.randomUUID()}.mp4`
      const { data: row, error: insertError } = await serviceSupabase
        .from('meeting_recordings')
        .insert({
          meeting_id: meetingId,
          host_id: authData.user.id,
          status: 'starting',
          recording_url: '',
          storage_path: storagePath,
          layout: 'grid',
          started_at: new Date().toISOString(),
        })
        .select('id, status, storage_path')
        .single()

      if (insertError || !row) {
        if (insertError?.code === '23505') {
          const { data: existing } = await serviceSupabase
            .from('meeting_recordings')
            .select('id, status, recording_sid')
            .eq('meeting_id', meetingId)
            .in('status', ['starting', 'recording'])
            .maybeSingle()
          if (existing) {
            return jsonResponse({
              ok: true,
              recordingId: existing.id,
              recordingSid: existing.recording_sid ?? undefined,
              status: existing.status,
              alreadyActive: true,
            })
          }
        }
        return jsonResponse(
          { ok: false, error: insertError?.message || 'Could not create recording record.' },
          500,
        )
      }

      try {
        const output = new EncodedFileOutput({
          fileType: EncodedFileType.MP4,
          filepath: storagePath,
          disableManifest: true,
          output: {
            case: 's3',
            value: {
              accessKey: s3.accessKey,
              secret: s3.secret,
              bucket: s3.bucket,
              region: s3.region,
              endpoint: s3.endpoint,
              forcePathStyle: s3.forcePathStyle,
            },
          },
        })

        const info = await egress.startRoomCompositeEgress(
          roomName,
          { file: output },
          {
            layout: 'grid',
            audioOnly: false,
            videoOnly: false,
          },
        )

        await serviceSupabase
          .from('meeting_recordings')
          .update({
            status: 'recording',
            recording_sid: info.egressId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)

        return jsonResponse({
          ok: true,
          recordingId: row.id,
          recordingSid: info.egressId,
          status: 'recording',
          storagePath,
        })
      } catch (startError) {
        const message =
          startError instanceof Error ? startError.message : 'Could not start cloud recording'
        await serviceSupabase
          .from('meeting_recordings')
          .update({
            status: 'failed',
            error_message: message,
            ended_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)

        return jsonResponse({ ok: false, error: message, recordingId: row.id, status: 'failed' }, 500)
      }
    }

    // ── stop ──────────────────────────────────────────────────────────────────
    if (!recordingId) {
      const { data: active } = await serviceSupabase
        .from('meeting_recordings')
        .select('id, recording_sid, status')
        .eq('meeting_id', meetingId)
        .in('status', ['starting', 'recording'])
        .order('created_at', { ascending: false })
        .maybeSingle()

      if (!active) {
        return jsonResponse({ ok: false, error: 'No active recording to stop.' }, 404)
      }

      return await stopRecording(serviceSupabase, egress, meetingId, active)
    }

    const { data: recording } = await serviceSupabase
      .from('meeting_recordings')
      .select('id, recording_sid, status')
      .eq('id', recordingId)
      .eq('meeting_id', meetingId)
      .maybeSingle()

    if (!recording) {
      return jsonResponse({ ok: false, error: 'Recording not found.' }, 404)
    }

    return await stopRecording(serviceSupabase, egress, meetingId, recording)
  } catch (error) {
    console.error('livekit-recording error:', error)
    return jsonResponse({ ok: false, error: 'Recording control failed.' }, 500)
  }
})

// ── helpers ───────────────────────────────────────────────────────────────────

async function stopRecording(
  serviceSupabase: ReturnType<typeof createClient>,
  egress: EgressClient,
  meetingId: string,
  recording: { id: string; recording_sid: string | null; status: string },
) {
  if (['processing', 'ready', 'failed'].includes(recording.status)) {
    return jsonResponse({
      ok: true,
      recordingId: recording.id,
      status: recording.status,
      alreadyStopped: true,
    })
  }

  if (recording.recording_sid) {
    try {
      await egress.stopEgress(recording.recording_sid)
    } catch (stopError) {
      // Egress may already be stopping / complete — continue to processing.
      console.warn('stopEgress warning:', stopError)
    }
  }

  await serviceSupabase
    .from('meeting_recordings')
    .update({
      status: 'processing',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', recording.id)
    .eq('meeting_id', meetingId)

  return jsonResponse({
    ok: true,
    recordingId: recording.id,
    status: 'processing',
  })
}

async function reconcileEgressRow(
  serviceSupabase: ReturnType<typeof createClient>,
  egress: EgressClient,
  row: Record<string, unknown>,
) {
  const egressId = String(row.recording_sid ?? '')
  if (!egressId) return row

  try {
    const listed = await egress.listEgress({ egressId })
    const info = (listed?.[0] ?? null) as Record<string, unknown> | null
    if (!info) return row

    const mapped = mapEgressStatusToRecordingStatus(
      (info.status as string | number | undefined) ?? null,
    )
    if (!mapped) return row

    const file = extractEgressFileInfo(info)
    const patch: Record<string, unknown> = {
      status: mapped,
      updated_at: new Date().toISOString(),
    }

    if (file.durationSeconds != null) patch.duration_seconds = file.durationSeconds
    if (file.size != null) patch.file_size_bytes = file.size
    if (file.filename && !row.storage_path) patch.storage_path = file.filename
    if (mapped === 'ready') {
      patch.error_message = null
      if (!row.ended_at) patch.ended_at = new Date().toISOString()
    }
    if (mapped === 'failed') {
      patch.error_message =
        (typeof info.error === 'string' && info.error) ||
        (typeof info.details === 'string' && info.details) ||
        'Recording failed'
      if (!row.ended_at) patch.ended_at = new Date().toISOString()
    }

    const { data: updated } = await serviceSupabase
      .from('meeting_recordings')
      .update(patch)
      .eq('id', row.id)
      .select(
        'id, meeting_id, host_id, status, recording_sid, recording_url, storage_path, duration_seconds, file_size_bytes, error_message, share_token_hash, share_created_at, share_revoked_at, started_at, ended_at, created_at, updated_at',
      )
      .single()

    return updated ?? { ...row, ...patch }
  } catch (error) {
    console.warn('reconcileEgressRow failed:', error)
    return row
  }
}

function sanitizeRecording(row: Record<string, unknown>) {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    hostId: row.host_id,
    status: row.status,
    recordingSid: row.recording_sid,
    storagePath: row.storage_path,
    durationSeconds: row.duration_seconds,
    fileSizeBytes: row.file_size_bytes,
    errorMessage: row.error_message,
    hasShareLink: !!row.share_token_hash && !row.share_revoked_at,
    shareCreatedAt: row.share_created_at,
    shareRevokedAt: row.share_revoked_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
