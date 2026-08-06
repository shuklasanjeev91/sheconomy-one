import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  mapCarrierStatus,
  shouldUpgradeStatus,
  type DeliveryStatusCanonical,
} from '../_shared/courier-track.ts'

function mergeMetadata(
  existing: unknown,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  return { ...base, ...extra }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'SHEDelivery webhook not configured' }, 503)
  }

  const url = new URL(request.url)
  const partner = (url.searchParams.get('partner') || 'shiprocket').toLowerCase()

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const awb = String(
    payload.awb ?? payload.awb_code ?? payload.tracking_id ?? payload.tracking_number ?? '',
  ).trim()
  const orderId = String(
    payload.order_id ?? payload.client_order_id ?? payload.orderId ?? '',
  ).trim()
  const statusRaw = String(
    payload.current_status ?? payload.status ?? payload.track_status ?? payload.shipment_status ?? '',
  )
  const nextStatus = mapCarrierStatus(statusRaw || 'in_transit') as DeliveryStatusCanonical

  if (!awb && !orderId) {
    return jsonResponse({ error: 'Missing tracking identifiers' }, 400)
  }

  let findQuery = admin
    .from('order_delivery')
    .select('id, delivery_status, delivery_metadata, shipped_at, carrier_tracking_url')
    .limit(5)

  if (awb) {
    findQuery = findQuery.or(`tracking_number.eq.${awb},awb_code.eq.${awb}`)
  } else if (orderId) {
    findQuery = findQuery.eq('order_id', orderId)
  }

  const { data: rows, error: findError } = await findQuery
  if (findError) return jsonResponse({ error: findError.message }, 500)
  if (!rows?.length) {
    return jsonResponse({ ok: true, matched: 0, partner, status: nextStatus })
  }

  const now = new Date().toISOString()
  let updated = 0

  for (const row of rows) {
    if (!shouldUpgradeStatus(row.delivery_status, nextStatus)) continue

    const updates: Record<string, unknown> = {
      delivery_status: nextStatus,
      updated_at: now,
      delivery_metadata: mergeMetadata(row.delivery_metadata, {
        webhook_partner: partner,
        last_checkpoint: statusRaw || null,
        last_tracked_at: now,
        webhook_payload: payload,
      }),
    }

    if (awb) {
      updates.tracking_number = awb
      updates.awb_code = awb
    }
    if (nextStatus === 'shipped' || nextStatus === 'in_transit') {
      updates.shipped_at = row.shipped_at ?? now
    }
    if (nextStatus === 'delivered') {
      updates.delivered_at = now
      updates.actual_delivery_date = now.split('T')[0]
    }

    const { error: updateError } = await admin.from('order_delivery').update(updates).eq('id', row.id)
    if (!updateError) updated += 1
  }

  return jsonResponse({ ok: true, partner, status: nextStatus, matched: rows.length, updated })
})
