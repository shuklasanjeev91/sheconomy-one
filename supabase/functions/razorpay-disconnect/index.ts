/**
 * POST /functions/v1/razorpay-disconnect
 *
 * Disconnect a vendor's Razorpay account.
 * Clears access_token, metadata, and sets status = 'disconnected'.
 * Resets shop_commerce_settings back to SheconomyPay (shepay).
 *
 * Body: { shopId }
 * Returns: { success: true }
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type DisconnectBody = { shopId: string }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: 'Service not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: DisconnectBody
  try {
    body = (await request.json()) as DisconnectBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const { shopId } = body
  if (!shopId) return jsonResponse({ error: 'shopId is required' }, 400)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Verify shop ownership
  const { data: shop } = await admin
    .from('shops')
    .select('id')
    .eq('id', shopId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!shop) return jsonResponse({ error: 'Forbidden: shop not found or not owned by you' }, 403)

  const now = new Date().toISOString()

  await admin
    .from('shop_payment_accounts')
    .update({
      status: 'disconnected',
      access_token: null,
      refresh_token: null,
      token_expiry: null,
      metadata: {},
      updated_at: now,
    })
    .eq('shop_id', shopId)
    .eq('provider', 'razorpay')

  // Reset checkout routing to SheconomyPay
  await admin.from('shop_commerce_settings').upsert(
    {
      shop_id: shopId,
      payment_connected: false,
      payment_mode: 'shepay',
      payment_gateway: null,
      payment_gateway_key_id: null,
      payment_account_label: null,
      updated_at: now,
    },
    { onConflict: 'shop_id', ignoreDuplicates: false },
  )

  return jsonResponse({ success: true })
})
