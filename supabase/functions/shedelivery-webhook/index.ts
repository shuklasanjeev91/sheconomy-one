import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '~/supabase/functions/_shared/cors.ts'

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
  )
  const orderId = String(
    payload.order_id ?? payload.client_order_id ?? payload.orderId ?? '',
  )
  const status = String(
    payload.current_status ?? payload.status ?? payload.track_status ?? 'in_transit',
  )

  if (!awb && !orderId) {
    return jsonResponse({ error: 'Missing tracking identifiers' }, 400)
  }

  let query = admin.from('order_delivery').update({
    status,
    tracking_number: awb || undefined,
    carrier: partner,
    updated_at: new Date().toISOString(),
    metadata: payload,
  } as never)

  if (orderId) {
    query = query.eq('order_id', orderId)
  } else {
    query = query.eq('tracking_number', awb)
  }

  const { error } = await query
  if (error) return jsonResponse({ error: error.message }, 500)

  return jsonResponse({ ok: true, partner, status })
})
