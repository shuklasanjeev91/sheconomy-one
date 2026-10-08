import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { mediasoupAdmin, MEDIASOUP_ROOM_PREFIX, verifyJwt } from '../_shared/mediasoup-admin.ts'
import { MEETING_RECORDINGS_BUCKET } from '../_shared/s3-sign.ts'

/**
 * Cloud recording on the mediasoup server: an ffmpeg recorder on the SFU host
 * composes the room into one MP4, then uploads it to the `meeting-recordings`
 * bucket through a signed upload URL issued here.
 *
 * Client actions (host JWT): check · start · stop · status · reconcile
 * Server actions (60s token signed with MEDIASOUP_JWT_SECRET): server-event
 */

type Action = 'start' | 'stop' | 'status' | 'reconcile' | 'check' | 'server-event'

const RECORDING_COLUMNS =
  'id, meeting_id, host_id, status, recording_sid, recording_url, storage_path, duration_seconds, file_size_bytes, error_message, share_token_hash, share_created_at, share_revoked_at, started_at, ended_at, created_at, updated_at'

type RecorderState = {
  state?: 'recording' | 'processing' | 'uploading' | 'ready' | 'failed' | 'unknown'
  durationSeconds?: number
  sizeBytes?: number
  error?: string
}

type RecordingComposition = {
  layout: 'grid'
  audio: 'mixed'
  video: 'composited'
  includeScreenShare: boolean
  tileMode: 'all'
}

const ZOOM_GRID_RECORDING_COMPOSITION: RecordingComposition = {
  layout: 'grid',
  audio: 'mixed',
  video: 'composited',
  includeScreenShare: true,
  tileMode: 'all',
}

function recordingEnabled() {
  return (
    !!Deno.env.get('MEDIASOUP_URL') &&
    !!Deno.env.get('MEDIASOUP_JWT_SECRET') &&
    Deno.env.get('MEDIASOUP_ENABLED') !== 'false' &&
    Deno.env.get('MEDIASOUP_RECORDING_ENABLED') !== 'false'
  )
}

function normalizeRecordingComposition(raw: unknown): RecordingComposition {
  if (!raw || typeof raw !== 'object') return ZOOM_GRID_RECORDING_COMPOSITION
  const value = raw as Record<string, unknown>
  return {
    layout: 'grid',
    audio: 'mixed',
    video: 'composited',
    includeScreenShare: value.includeScreenShare !== false,
    tileMode: 'all',
  }
}

function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? '') as Action

    if (action === 'check') {
      return jsonResponse({ ok: true, recordingConfigured: recordingEnabled() })
    }

    if (!recordingEnabled()) {
      return jsonResponse(
        { ok: false, error: 'Cloud recording is not configured.', configRequired: true },
        503,
      )
    }

    const serviceSupabase = serviceClient()

    if (action === 'server-event') {
      return await handleServerEvent(serviceSupabase, body)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)

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
    if (meetingError || !meeting) return jsonResponse({ ok: false, error: 'Meeting not found.' }, 404)
    if (meeting.host_id !== authData.user.id) {
      return jsonResponse({ ok: false, error: 'Only the host can control recording.' }, 403)
    }
    if (roomName && meeting.room_id !== roomName) {
      return jsonResponse({ ok: false, error: 'Invalid room.' }, 403)
    }

    // ── status / reconcile ──────────────────────────────────────────────────
    if (action === 'status' || action === 'reconcile') {
      let query = serviceSupabase
        .from('meeting_recordings')
        .select(RECORDING_COLUMNS)
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false })
      if (recordingId) query = query.eq('id', recordingId)

      const { data: rows, error: listError } = await query.limit(recordingId ? 1 : 20)
      if (listError) return jsonResponse({ ok: false, error: 'Could not load recordings.' }, 500)

      const recordings: ReturnType<typeof sanitizeRecording>[] = []
      for (const row of rows ?? []) {
        let next = row
        if (action === 'reconcile' && ['starting', 'recording', 'processing'].includes(row.status)) {
          next = await reconcileRow(serviceSupabase, row)
        }
        recordings.push(sanitizeRecording(next))
      }
      return jsonResponse({ ok: true, recording: recordings[0] ?? null, recordings })
    }

    // ── start ───────────────────────────────────────────────────────────────
    if (action === 'start') {
      if (meeting.status === 'ended') {
        return jsonResponse({ ok: false, error: 'Meeting has ended.' }, 400)
      }
      const composition = normalizeRecordingComposition(body.composition)

      const findActive = () =>
        serviceSupabase
          .from('meeting_recordings')
          .select('id, status, recording_sid')
          .eq('meeting_id', meetingId)
          .in('status', ['starting', 'recording'])
          .maybeSingle()

      const { data: active } = await findActive()
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
          const { data: existing } = await findActive()
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

      const started = await mediasoupAdmin<{ error?: string }>('record/start', {
        room: `${MEDIASOUP_ROOM_PREFIX}${roomName}`,
        recordingId: row.id,
        layout: composition.layout,
        audio: composition.audio,
        video: composition.video,
        composition,
      }).catch((cause) => ({ status: 502, data: { error: String(cause) } }))

      if (started.status >= 400) {
        const message = started.data?.error || 'Could not start cloud recording'
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

      await serviceSupabase
        .from('meeting_recordings')
        .update({ status: 'recording', recording_sid: row.id, updated_at: new Date().toISOString() })
        .eq('id', row.id)

      return jsonResponse({
        ok: true,
        recordingId: row.id,
        recordingSid: row.id,
        status: 'recording',
        storagePath,
      })
    }

    // ── stop ────────────────────────────────────────────────────────────────
    let stopQuery = serviceSupabase
      .from('meeting_recordings')
      .select('id, recording_sid, status')
      .eq('meeting_id', meetingId)
    stopQuery = recordingId
      ? stopQuery.eq('id', recordingId)
      : stopQuery.in('status', ['starting', 'recording']).order('created_at', { ascending: false })
    const { data: recording } = await stopQuery.limit(1).maybeSingle()
    if (!recording) {
      return jsonResponse(
        { ok: false, error: recordingId ? 'Recording not found.' : 'No active recording to stop.' },
        404,
      )
    }
    return await stopRecording(serviceSupabase, meetingId, recording)
  } catch (error) {
    console.error('mediasoup-recording error:', error)
    return jsonResponse({ ok: false, error: 'Recording control failed.' }, 500)
  }
})

// ── helpers ─────────────────────────────────────────────────────────────────

async function stopRecording(
  serviceSupabase: SupabaseClient,
  meetingId: string,
  recording: { id: string; recording_sid: string | null; status: string },
) {
  if (['processing', 'ready', 'failed'].includes(recording.status)) {
    return jsonResponse({ ok: true, recordingId: recording.id, status: recording.status, alreadyStopped: true })
  }

  // The recorder may already be finishing (room closed) — continue to processing.
  await mediasoupAdmin('record/stop', { recordingId: recording.id }).catch((cause) =>
    console.warn('record/stop warning:', cause),
  )

  await serviceSupabase
    .from('meeting_recordings')
    .update({ status: 'processing', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', recording.id)
    .eq('meeting_id', meetingId)

  return jsonResponse({ ok: true, recordingId: recording.id, status: 'processing' })
}

/** Webhooks can be missed (function cold start, network) — ask the recorder directly. */
async function reconcileRow(serviceSupabase: SupabaseClient, row: Record<string, unknown>) {
  try {
    const { status, data } = await mediasoupAdmin<RecorderState>('record/status', { recordingId: row.id })
    const state = status === 404 ? 'unknown' : data?.state
    if (!state || state === 'recording' || state === 'processing' || state === 'uploading') return row

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (state === 'ready') {
      // Only the server-event upload confirmation flips to ready; here we just fail lost jobs.
      return row
    }
    patch.status = 'failed'
    patch.error_message =
      state === 'unknown' ? 'The recorder stopped unexpectedly.' : data?.error || 'Recording failed'
    if (!row.ended_at) patch.ended_at = new Date().toISOString()

    const { data: updated } = await serviceSupabase
      .from('meeting_recordings')
      .update(patch)
      .eq('id', row.id)
      .select(RECORDING_COLUMNS)
      .single()
    return updated ?? { ...row, ...patch }
  } catch (error) {
    console.warn('reconcileRow failed:', error)
    return row
  }
}

/**
 * Recorder callbacks:
 *   upload-url → signed upload URL for the row's storage path
 *   ready      → file uploaded (duration / size)
 *   failed     → error message
 */
async function handleServerEvent(serviceSupabase: SupabaseClient, body: Record<string, unknown>) {
  const secret = Deno.env.get('MEDIASOUP_JWT_SECRET') ?? ''
  const claims = await verifyJwt(String(body.token ?? ''), secret)
  const recordingId = String(body.recordingId ?? '')
  if (!claims?.adm || !recordingId || claims.rec !== recordingId) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
  }

  const { data: row } = await serviceSupabase
    .from('meeting_recordings')
    .select('id, status, storage_path, ended_at')
    .eq('id', recordingId)
    .maybeSingle()
  if (!row) return jsonResponse({ ok: false, error: 'Recording not found.' }, 404)

  const event = String(body.event ?? '')
  const now = new Date().toISOString()

  if (event === 'upload-url') {
    const bucket = Deno.env.get('MEETING_RECORDINGS_BUCKET') || MEETING_RECORDINGS_BUCKET
    const { data, error } = await serviceSupabase.storage
      .from(bucket)
      .createSignedUploadUrl(row.storage_path, { upsert: true })
    if (error || !data) {
      return jsonResponse({ ok: false, error: error?.message || 'Could not create upload URL.' }, 500)
    }
    await serviceSupabase
      .from('meeting_recordings')
      .update({ status: 'processing', ended_at: row.ended_at ?? now, updated_at: now })
      .eq('id', recordingId)
    return jsonResponse({ ok: true, uploadUrl: data.signedUrl })
  }

  if (event === 'ready') {
    const duration = Number(body.durationSeconds)
    const size = Number(body.sizeBytes)
    await serviceSupabase
      .from('meeting_recordings')
      .update({
        status: 'ready',
        error_message: null,
        ...(Number.isFinite(duration) ? { duration_seconds: Math.round(duration) } : {}),
        ...(Number.isFinite(size) ? { file_size_bytes: Math.round(size) } : {}),
        ended_at: row.ended_at ?? now,
        updated_at: now,
      })
      .eq('id', recordingId)
    return jsonResponse({ ok: true })
  }

  if (event === 'failed') {
    await serviceSupabase
      .from('meeting_recordings')
      .update({
        status: 'failed',
        error_message: String(body.error ?? 'Recording failed').slice(0, 500),
        ended_at: row.ended_at ?? now,
        updated_at: now,
      })
      .eq('id', recordingId)
    return jsonResponse({ ok: true })
  }

  return jsonResponse({ ok: false, error: 'Unknown event.' }, 400)
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
