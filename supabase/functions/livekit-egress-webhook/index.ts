import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { WebhookReceiver } from 'npm:livekit-server-sdk@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  extractEgressFileInfo,
  mapEgressStatusToRecordingStatus,
} from '../_shared/recording-helpers.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('LIVEKIT_API_KEY')
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
    if (!apiKey || !apiSecret) {
      return jsonResponse({ ok: false, error: 'LiveKit webhook secrets are not configured.' }, 500)
    }

    const body = await req.text()
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? ''
    const receiver = new WebhookReceiver(apiKey, apiSecret)
    const event = await receiver.receive(body, authHeader)

    if (!event?.event) {
      return jsonResponse({ ok: false, error: 'Invalid webhook payload.' }, 400)
    }

    const eventName = String(event.event)
    if (!['egress_started', 'egress_updated', 'egress_ended'].includes(eventName)) {
      return jsonResponse({ ok: true, ignored: true, event: eventName })
    }

    const egressInfo = (event.egressInfo ?? null) as Record<string, unknown> | null
    if (!egressInfo?.egressId) {
      return jsonResponse({ ok: true, ignored: true, reason: 'missing egress info' })
    }

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const egressId = String(egressInfo.egressId)
    const { data: row } = await serviceSupabase
      .from('meeting_recordings')
      .select('id, status, storage_path, ended_at')
      .eq('recording_sid', egressId)
      .maybeSingle()

    if (!row) {
      return jsonResponse({ ok: true, ignored: true, reason: 'unknown egress', egressId })
    }

    const mapped =
      mapEgressStatusToRecordingStatus(egressInfo.status as string | number | undefined) ??
      (eventName === 'egress_started'
        ? 'recording'
        : eventName === 'egress_ended'
          ? 'processing'
          : null)

    if (!mapped) {
      return jsonResponse({ ok: true, ignored: true, reason: 'unmapped status' })
    }

    const file = extractEgressFileInfo(egressInfo)
    const patch: Record<string, unknown> = {
      status: mapped === 'processing' && eventName === 'egress_ended' && !egressInfo.error
        ? // Prefer ready when file metadata exists; otherwise keep processing for reconcile.
          file.location || file.filename || file.size
          ? 'ready'
          : 'processing'
        : mapped,
      updated_at: new Date().toISOString(),
    }

    if (eventName === 'egress_ended' && egressInfo.error) {
      patch.status = 'failed'
      patch.error_message =
        (typeof egressInfo.error === 'string' && egressInfo.error) ||
        (typeof egressInfo.details === 'string' && egressInfo.details) ||
        'Recording failed'
    }

    if (file.durationSeconds != null) patch.duration_seconds = file.durationSeconds
    if (file.size != null) patch.file_size_bytes = file.size
    if (file.filename && !row.storage_path) patch.storage_path = file.filename

    if (patch.status === 'ready' || patch.status === 'failed' || patch.status === 'processing') {
      if (!row.ended_at) patch.ended_at = new Date().toISOString()
    }
    if (patch.status === 'ready') {
      patch.error_message = null
    }

    await serviceSupabase.from('meeting_recordings').update(patch).eq('id', row.id)

    return jsonResponse({
      ok: true,
      recordingId: row.id,
      status: patch.status,
      event: eventName,
    })
  } catch (error) {
    console.error('livekit-egress-webhook error:', error)
    return jsonResponse({ ok: false, error: 'Webhook processing failed.' }, 400)
  }
})
