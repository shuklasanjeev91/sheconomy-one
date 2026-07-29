import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '~/supabase/functions/_shared/cors.ts'
import { createShareToken, hashShareToken } from '~/supabase/functions/_shared/recording-helpers.ts'
import {
  createRecordingDownloadUrl,
  createRecordingPlaybackUrl,
} from '~/supabase/functions/_shared/s3-sign.ts'

type Action = 'list' | 'createShare' | 'revokeShare' | 'resolve' | 'download'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? '') as Action
    const meetingId = body.meetingId ? String(body.meetingId) : ''
    const recordingId = body.recordingId ? String(body.recordingId) : ''
    const token = body.token ? String(body.token) : ''

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (action === 'resolve') {
      if (!token) return jsonResponse({ ok: false, error: 'token is required.' }, 400)
      const tokenHash = await hashShareToken(token)
      const { data: row } = await serviceSupabase
        .from('meeting_recordings')
        .select(
          'id, meeting_id, status, storage_path, duration_seconds, file_size_bytes, share_revoked_at, ended_at, created_at',
        )
        .eq('share_token_hash', tokenHash)
        .maybeSingle()

      if (!row || row.share_revoked_at) {
        return jsonResponse({ ok: false, error: 'Recording link is invalid or has been revoked.' }, 404)
      }
      if (row.status !== 'ready' || !row.storage_path) {
        return jsonResponse(
          {
            ok: false,
            error:
              row.status === 'failed'
                ? 'This recording failed and is unavailable.'
                : 'This recording is still processing. Try again shortly.',
            status: row.status,
          },
          409,
        )
      }

      const playbackUrl = await createRecordingPlaybackUrl(row.storage_path, 60 * 30)
      return jsonResponse({
        ok: true,
        recordingId: row.id,
        meetingId: row.meeting_id,
        status: row.status,
        durationSeconds: row.duration_seconds,
        fileSizeBytes: row.file_size_bytes,
        endedAt: row.ended_at,
        createdAt: row.created_at,
        playbackUrl,
        expiresInSeconds: 60 * 30,
      })
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

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    if (!['list', 'createShare', 'revokeShare', 'download'].includes(action)) {
      return jsonResponse({ ok: false, error: 'Invalid action.' }, 400)
    }

    if (action === 'list') {
      if (!meetingId) return jsonResponse({ ok: false, error: 'meetingId is required.' }, 400)
      await assertHost(supabase, meetingId, authData.user.id)

      const { data: rows, error } = await serviceSupabase
        .from('meeting_recordings')
        .select(
          'id, meeting_id, status, storage_path, duration_seconds, file_size_bytes, error_message, share_token_hash, share_created_at, share_revoked_at, started_at, ended_at, created_at, updated_at',
        )
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false })

      if (error) {
        return jsonResponse({ ok: false, error: 'Could not list recordings.' }, 500)
      }

      return jsonResponse({
        ok: true,
        recordings: (rows ?? []).map((row) => ({
          id: row.id,
          meetingId: row.meeting_id,
          status: row.status,
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
          ready: row.status === 'ready' && !!row.storage_path,
        })),
      })
    }

    if (!recordingId) {
      return jsonResponse({ ok: false, error: 'recordingId is required.' }, 400)
    }

    const { data: recording } = await serviceSupabase
      .from('meeting_recordings')
      .select(
        'id, meeting_id, host_id, status, storage_path, share_token_hash, share_revoked_at',
      )
      .eq('id', recordingId)
      .maybeSingle()

    if (!recording) {
      return jsonResponse({ ok: false, error: 'Recording not found.' }, 404)
    }

    await assertHost(supabase, recording.meeting_id, authData.user.id)

    if (action === 'download') {
      if (recording.status !== 'ready' || !recording.storage_path) {
        return jsonResponse({ ok: false, error: 'Recording is not ready to download.' }, 409)
      }
      const downloadUrl = await createRecordingDownloadUrl(recording.storage_path, 60 * 60)
      return jsonResponse({
        ok: true,
        downloadUrl,
        expiresInSeconds: 60 * 60,
      })
    }

    if (action === 'revokeShare') {
      await serviceSupabase
        .from('meeting_recordings')
        .update({
          share_revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', recording.id)

      return jsonResponse({ ok: true, recordingId: recording.id, revoked: true })
    }

    // createShare / rotate
    if (recording.status !== 'ready') {
      return jsonResponse(
        { ok: false, error: 'Share links are available after the recording is ready.' },
        409,
      )
    }

    const plainToken = createShareToken()
    const tokenHash = await hashShareToken(plainToken)
    const appUrl = (Deno.env.get('PUBLIC_APP_URL') ?? 'https://sheconomy.com').replace(/\/$/, '')
    const sharePath = `/co-work/recording/${encodeURIComponent(plainToken)}`
    const shareUrl = `${appUrl}${sharePath}`

    await serviceSupabase
      .from('meeting_recordings')
      .update({
        share_token_hash: tokenHash,
        share_created_at: new Date().toISOString(),
        share_revoked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recording.id)

    return jsonResponse({
      ok: true,
      recordingId: recording.id,
      shareUrl,
      sharePath,
      rotated: !!recording.share_token_hash,
    })
  } catch (error) {
    console.error('meeting-recording-share error:', error)
    const message = error instanceof Error ? error.message : 'Share request failed.'
    const status = message.includes('Only the host') ? 403 : 500
    return jsonResponse({ ok: false, error: message }, status)
  }
})

async function assertHost(
  supabase: ReturnType<typeof createClient>,
  meetingId: string,
  userId: string,
) {
  const { data: meeting, error } = await supabase
    .from('meetings')
    .select('id, host_id')
    .eq('id', meetingId)
    .maybeSingle()

  if (error || !meeting) {
    throw new Error('Meeting not found.')
  }
  if (meeting.host_id !== userId) {
    throw new Error('Only the host can manage recording links.')
  }
}
