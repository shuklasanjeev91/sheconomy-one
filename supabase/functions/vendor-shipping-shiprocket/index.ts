import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external'
const TOKEN_TTL_MS = 10 * 24 * 60 * 60 * 1000

type Body = {
  action: 'status' | 'connect' | 'disconnect'
  shopId: string
  email?: string
  password?: string
}

async function shiprocketLogin(email: string, password: string) {
  const response = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json()
  if (!response.ok || !data.token) {
    throw new Error(data.message || data.error || 'Shiprocket authentication failed.')
  }
  return data as { token: string; company_id?: number; email?: string }
}

async function verifyToken(token: string) {
  try {
    const response = await fetch(`${SHIPROCKET_BASE_URL}/settings/company/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.ok
  } catch {
    return false
  }
}

async function fetchPickupLocations(token: string) {
  const response = await fetch(`${SHIPROCKET_BASE_URL}/settings/company/pickup`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return []
  const data = await response.json()
  return data?.data?.shipping_address ?? []
}

async function fetchChannels(token: string) {
  const response = await fetch(`${SHIPROCKET_BASE_URL}/channels`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return []
  const data = await response.json()
  return data?.data ?? []
}

async function assertShopOwner(supabase: ReturnType<typeof createClient>, shopId: string, userId: string) {
  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()

  if (error || !shop || shop.user_id !== userId) {
    return null
  }
  return shop
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anon) return jsonResponse({ error: 'Not configured' }, 503)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  if (!body.shopId || !body.action) {
    return jsonResponse({ error: 'shopId and action are required' }, 400)
  }

  const supabase = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const shop = await assertShopOwner(supabase, body.shopId, user.id)
  if (!shop) return jsonResponse({ error: 'Shop not found' }, 404)

  if (body.action === 'status') {
    const { data: config } = await supabase
      .from('shiprocket_config')
      .select('*')
      .eq('shop_id', body.shopId)
      .maybeSingle()

    if (!config) {
      return jsonResponse({ connected: false, message: 'Shiprocket not connected' })
    }

    if (!config.api_token) {
      return jsonResponse({ connected: false, message: 'Shiprocket not connected' })
    }

    const valid = await verifyToken(config.api_token)
    if (!valid) {
      await supabase
        .from('shiprocket_config')
        .update({ is_connected: false })
        .eq('shop_id', body.shopId)
      return jsonResponse({ connected: false, expired: true, message: 'Shiprocket token expired' })
    }

    return jsonResponse({
      connected: true,
      config: {
        id: config.id,
        email: config.email,
        is_connected: config.is_connected,
        company_id: config.company_id,
        channel_id: config.channel_id,
        pickup_location_id: config.pickup_location_id,
        auto_ship_enabled: config.auto_ship_enabled,
        last_sync_at: config.last_sync_at,
      },
    })
  }

  if (body.action === 'disconnect') {
    const { error: updateError } = await supabase
      .from('shiprocket_config')
      .update({ is_connected: false, api_token: null, token_expiry: null })
      .eq('shop_id', body.shopId)

    if (updateError) return jsonResponse({ error: 'Failed to disconnect' }, 500)

    await supabase
      .from('shipping_providers')
      .update({ is_active: false })
      .eq('shop_id', body.shopId)
      .eq('provider_type', 'shiprocket')

    return jsonResponse({ success: true, message: 'Shiprocket disconnected successfully' })
  }

  if (body.action === 'connect') {
    if (!body.email || !body.password) {
      return jsonResponse({ error: 'Email and password are required' }, 400)
    }

    const auth = await shiprocketLogin(body.email, body.password)
    const pickupLocations = await fetchPickupLocations(auth.token)
    const channels = await fetchChannels(auth.token)

    const { data: config, error: configError } = await supabase
      .from('shiprocket_config')
      .upsert(
        {
          shop_id: body.shopId,
          email: body.email,
          api_token: auth.token,
          token_expiry: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
          company_id: auth.company_id ?? null,
          channel_id: channels[0]?.id ?? null,
          pickup_location_id: pickupLocations[0]?.id ?? null,
          is_connected: true,
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id' },
      )
      .select()
      .single()

    if (configError) return jsonResponse({ error: 'Failed to save configuration' }, 500)

    await supabase.from('shipping_providers').upsert(
      {
        shop_id: body.shopId,
        provider_type: 'shiprocket',
        provider_name: 'Shiprocket',
        is_active: true,
        is_primary: true,
        priority: 1,
        configuration: {
          company_id: auth.company_id,
          channel_id: channels[0]?.id ?? null,
          pickup_location_id: pickupLocations[0]?.id ?? null,
        },
      },
      { onConflict: 'shop_id,provider_name' },
    )

    return jsonResponse({
      success: true,
      connected: true,
      message: 'Shiprocket connected successfully',
      config: {
        id: config.id,
        email: config.email,
        is_connected: config.is_connected,
        company_id: config.company_id,
        channel_id: config.channel_id,
        pickup_location_id: config.pickup_location_id,
        auto_ship_enabled: config.auto_ship_enabled,
        last_sync_at: config.last_sync_at,
      },
    })
  }

  return jsonResponse({ error: 'Unknown action' }, 400)
})
