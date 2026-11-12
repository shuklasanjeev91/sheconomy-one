/**
 * POST /functions/v1/easyship-webhook
 * Easyship shipment/label/tracking webhooks → order_delivery status sync
 * (in_transit / delivered / RTO returned_to_sender / failed).
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  mapCarrierStatus,
  shouldUpgradeStatus,
  type DeliveryStatusCanonical,
} from '../_shared/courier-track.ts'

type Json = Record<string, unknown>

function asRecord(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {}
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function b64urlToBytes(input: string): Uint8Array {
  const pad = '='.repeat((4 - (input.length % 4)) % 4)
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function verifyEasyshipSignature(
  signature: string | null,
  secret: string | null,
): Promise<boolean> {
  if (!secret) return true
  if (!signature) return false
  const parts = signature.split('.')
  if (parts.length !== 3) return false
  const [header, payload, sig] = parts
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const data = new TextEncoder().encode(`${header}.${payload}`)
  return crypto.subtle.verify('HMAC', key, b64urlToBytes(sig), data)
}

function mapEasyshipDeliveryState(raw: string | null | undefined): DeliveryStatusCanonical {
  const s = (raw ?? '').toLowerCase()
  if (!s) return 'shipped'
  if (s.includes('delivered')) return 'delivered'
  if (s.includes('out_for_delivery') || s.includes('out for delivery')) {
    return 'out_for_delivery'
  }
  if (s.includes('returned') || s.includes('rto')) return 'returned_to_sender'
  if (s.includes('exception') || s.includes('fail')) return 'failed_delivery'
  if (s.includes('cancel')) return 'cancelled'
  // Pickup / dispatched / collected → in_transit so customers get a progress ping.
  if (
    s.includes('pickup') ||
    s.includes('picked') ||
    s.includes('collected') ||
    s.includes('dispatch') ||
    s.includes('in_transit') ||
    s.includes('transit')
  ) {
    return 'in_transit'
  }
  return mapCarrierStatus(raw)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Not configured' }, 503)
  }

  const secret =
    Deno.env.get('EASYSHIP_WEBHOOK_SECRET')?.trim() ||
    Deno.env.get('EASYSHIP_WEBHOOK_TOKEN')?.trim() ||
    null
  const signature =
    request.headers.get('x-easyship-signature') ||
    request.headers.get('X-EASYSHIP-SIGNATURE')

  const okSig = await verifyEasyshipSignature(signature, secret)
  if (!okSig) return jsonResponse({ error: 'Invalid signature' }, 401)

  let payload: Json = {}
  try {
    payload = asRecord(await request.json())
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const eventType = pickString(payload.event_type, payload.event, asRecord(payload.meta).event_type) ||
    'unknown'
  const shipment = asRecord(
    payload.shipment ?? asRecord(payload.data).shipment ?? payload.data ?? payload,
  )
  const tracking = asRecord(shipment.tracking ?? payload.tracking)
  const easyshipShipmentId = pickString(
    shipment.easyship_shipment_id,
    shipment.easyshipShipmentId,
    shipment.id,
    payload.easyship_shipment_id,
  )
  const trackingNumber = pickString(
    shipment.tracking_number,
    shipment.track_number,
    tracking.tracking_number,
  )
  const deliveryState = pickString(
    shipment.delivery_state,
    tracking.status,
    tracking.delivery_state,
    asRecord(payload.tracking_status).status,
  )

  if (eventType.includes('credit') && eventType.includes('balance')) {
    console.warn('easyship credit_balance_low', JSON.stringify(payload).slice(0, 500))
    return jsonResponse({ ok: true, handled: 'credit_balance_low' })
  }

  if (!easyshipShipmentId && !trackingNumber) {
    // Still 2xx so Easyship does not disable the webhook.
    return jsonResponse({ ok: true, ignored: true, eventType })
  }

  const nextStatus = mapEasyshipDeliveryState(deliveryState)
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let query = admin
    .from('order_delivery')
    .select('id, delivery_status, delivery_metadata, tracking_number, shipped_at, delivered_at')
    .limit(40)

  if (easyshipShipmentId) {
    query = query.contains('delivery_metadata', { easyship_shipment_id: easyshipShipmentId })
  } else if (trackingNumber) {
    query = query.eq('tracking_number', trackingNumber)
  }

  const { data: rows, error } = await query
  if (error) {
    console.error('easyship-webhook lookup', error.message)
    return jsonResponse({ error: error.message }, 500)
  }

  const now = new Date().toISOString()
  let updated = 0
  for (const row of rows ?? []) {
    const current = typeof row.delivery_status === 'string' ? row.delivery_status : null
    if (!shouldUpgradeStatus(current, nextStatus)) continue

    const meta = asRecord(row.delivery_metadata)
    const patch: Json = {
      delivery_status: nextStatus,
      delivery_metadata: {
        ...meta,
        courier_slug: meta.courier_slug || 'easyship',
        notify_customer: meta.notify_customer !== false,
        easyship_shipment_id: easyshipShipmentId || meta.easyship_shipment_id || null,
        easyship_event_type: eventType,
        easyship_delivery_state: deliveryState,
        easyship_last_webhook_at: now,
      },
      updated_at: now,
    }
    if (trackingNumber) {
      patch.tracking_number = trackingNumber
      patch.awb_code = trackingNumber
    }
    if (nextStatus === 'delivered') patch.delivered_at = now
    if (
      nextStatus === 'shipped' ||
      nextStatus === 'in_transit' ||
      nextStatus === 'out_for_delivery'
    ) {
      patch.shipped_at = row.shipped_at || now
    }

    const { error: upErr } = await admin.from('order_delivery').update(patch).eq('id', row.id)
    if (upErr) {
      console.error('easyship-webhook update', row.id, upErr.message)
      continue
    }
    updated += 1
  }

  return jsonResponse({
    ok: true,
    eventType,
    easyshipShipmentId,
    nextStatus,
    matched: rows?.length ?? 0,
    updated,
  })
})
