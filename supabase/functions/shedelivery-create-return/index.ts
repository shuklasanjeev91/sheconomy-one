import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

// Reverse pickup booking. Mirrors shedelivery-create-shipment but hits
// Shiprocket's return-order endpoint. Pickup = buyer address, delivery = seller.
type Body = {
  order_id: string
  partner?: 'shiprocket'
  payload: Record<string, unknown>
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceRole || !anon) {
    return jsonResponse({ error: 'SHEdelivery is not configured' }, 503)
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  if (!body.order_id || !body.payload) {
    return jsonResponse({ error: 'order_id and payload required' }, 400)
  }

  const partner = body.partner ?? 'shiprocket'
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  let shipmentId = ''
  let awb: string | null = null
  let trackingUrl: string | null = null
  let raw: unknown = null

  try {
    if (partner !== 'shiprocket') {
      return jsonResponse({ error: 'Reverse pickup is only supported on Shiprocket' }, 400)
    }
    const email = Deno.env.get('SHIPROCKET_EMAIL')
    const password = Deno.env.get('SHIPROCKET_PASSWORD')
    if (!email || !password) {
      return jsonResponse({ error: 'Shiprocket credentials missing' }, 503)
    }
    const authRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!authRes.ok) return jsonResponse({ error: 'Shiprocket auth failed' }, 502)
    const authJson = (await authRes.json()) as { token?: string }
    const token = authJson.token
    if (!token) return jsonResponse({ error: 'Shiprocket token missing' }, 502)

    const createRes = await fetch(
      'https://apiv2.shiprocket.in/v1/external/orders/create/return',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body.payload),
      },
    )
    raw = await createRes.json()
    if (!createRes.ok) {
      return jsonResponse({ error: 'Shiprocket return create failed', raw }, 502)
    }
    const created = raw as Record<string, unknown>
    shipmentId = String(created.shipment_id ?? created.order_id ?? '')
    awb = created.awb_code == null ? null : String(created.awb_code)
    trackingUrl = awb ? `https://shiprocket.co/tracking/${awb}` : null
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'SHEdelivery return create failed' },
      502,
    )
  }

  return jsonResponse({
    partner,
    shipment_id: shipmentId,
    awb,
    tracking_url: trackingUrl,
    raw,
  })
})
