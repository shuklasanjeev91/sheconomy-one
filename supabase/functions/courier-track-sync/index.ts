import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  shouldUpgradeStatus,
  trackShipment,
  type DeliveryStatusCanonical,
} from '../_shared/courier-track.ts'

type Body = {
  delivery_id?: string
  limit?: number
}

const IN_FLIGHT = ['shipped', 'in_transit', 'out_for_delivery'] as const

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
    return jsonResponse({ error: 'Courier track sync not configured' }, 503)
  }

  const cronSecret = Deno.env.get('NOTIFICATION_CRON_SECRET') ?? Deno.env.get('COURIER_TRACK_CRON_SECRET')
  const headerSecret = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('Authorization')
  const isCron = Boolean(cronSecret && headerSecret && headerSecret === cronSecret)
  const isService =
    Boolean(serviceRole && authHeader === `Bearer ${serviceRole}`) ||
    Boolean(authHeader?.startsWith('Bearer ') && authHeader.length > 20)

  if (!isCron && !isService && !authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    body = {}
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const limit = Math.min(Math.max(body.limit ?? 40, 1), 100)

  let query = admin
    .from('order_delivery')
    .select(
      'id, order_id, tracking_number, awb_code, delivery_status, carrier_tracking_url, delivery_metadata, shipped_at, delivered_at',
    )
    .not('tracking_number', 'is', null)
    .in('delivery_status', [...IN_FLIGHT])
    .order('updated_at', { ascending: true })
    .limit(limit)

  if (body.delivery_id) {
    query = admin
      .from('order_delivery')
      .select(
        'id, order_id, tracking_number, awb_code, delivery_status, carrier_tracking_url, delivery_metadata, shipped_at, delivered_at',
      )
      .eq('id', body.delivery_id)
      .limit(1)
  }

  const { data: rows, error } = await query
  if (error) return jsonResponse({ error: error.message }, 500)

  const results: Array<{ id: string; updated: boolean; status?: string; provider?: string }> = []

  for (const row of rows ?? []) {
    const trackingNumber = String(row.tracking_number ?? row.awb_code ?? '').trim()
    if (!trackingNumber) {
      results.push({ id: row.id, updated: false })
      continue
    }

    const meta =
      row.delivery_metadata && typeof row.delivery_metadata === 'object'
        ? (row.delivery_metadata as Record<string, unknown>)
        : {}
    const courierSlug =
      typeof meta.courier_slug === 'string'
        ? meta.courier_slug
        : typeof meta.carrier_slug === 'string'
          ? meta.carrier_slug
          : null

    const track = await trackShipment({ trackingNumber, courierSlug })
    if (track.provider === 'none' && track.status === 'shipped' && row.delivery_status === 'shipped') {
      results.push({ id: row.id, updated: false, provider: 'none' })
      continue
    }

    const nextStatus = track.status as DeliveryStatusCanonical
    const shouldUpdate = shouldUpgradeStatus(row.delivery_status, nextStatus)
    if (!shouldUpdate && !track.trackingUrl && !track.checkpoint) {
      results.push({ id: row.id, updated: false, status: row.delivery_status, provider: track.provider })
      continue
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      updated_at: now,
      delivery_metadata: mergeMetadata(meta, {
        last_track_provider: track.provider,
        last_checkpoint: track.checkpoint,
        last_tracked_at: now,
        carrier_slug: track.carrierSlug ?? courierSlug,
      }),
    }

    if (shouldUpdate) {
      updates.delivery_status = nextStatus
      if (nextStatus === 'shipped' || nextStatus === 'in_transit') {
        updates.shipped_at = row.shipped_at ?? now
      }
      if (nextStatus === 'delivered') {
        updates.delivered_at = now
        updates.actual_delivery_date = now.split('T')[0]
      }
    }

    if (track.trackingUrl && !row.carrier_tracking_url) {
      updates.carrier_tracking_url = track.trackingUrl
    }

    const { error: updateError } = await admin.from('order_delivery').update(updates).eq('id', row.id)
    if (updateError) {
      results.push({ id: row.id, updated: false, provider: track.provider })
      continue
    }

    if (shouldUpdate && nextStatus === 'delivered' && row.order_id) {
      await admin.rpc('schedule_shepay_release_on_delivery', { p_order_id: row.order_id })
    }

    results.push({
      id: row.id,
      updated: shouldUpdate,
      status: shouldUpdate ? nextStatus : row.delivery_status,
      provider: track.provider,
    })
  }

  return jsonResponse({
    ok: true,
    processed: results.length,
    updated: results.filter((r) => r.updated).length,
    results,
  })
})
