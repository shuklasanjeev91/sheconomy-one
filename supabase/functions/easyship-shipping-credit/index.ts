/**
 * POST /functions/v1/easyship-shipping-credit
 * Vendor JWT: balance, recent ledger, projected pending freight for a shop.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { EASYSHIP_SELLER_RECHARGE_PATH } from '../_shared/easyship.ts'

type Body = {
  shopId?: string
  action?: 'status' | 'topup'
  amount?: number
  idempotencyKey?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: 'Not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const body = (await request.json().catch(() => ({}))) as Body
  const shopId = String(body.shopId || '').trim()
  if (!shopId) return jsonResponse({ error: 'shopId required' }, 400)

  const { data: shop } = await admin
    .from('shops')
    .select('id, user_id')
    .eq('id', shopId)
    .maybeSingle()
  if (!shop || shop.user_id !== userData.user.id) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  const action = body.action || 'status'

  if (action === 'topup') {
    // Staff/ops top-up only via service path for v1 — vendors get recharge CTA;
    // allow self-service recording when amount + idempotency provided by trusted clients.
    const amount = Number(body.amount)
    const key = String(body.idempotencyKey || '').trim()
    if (!(amount > 0) || !key) {
      return jsonResponse({ error: 'amount and idempotencyKey required for topup' }, 400)
    }
    const { data, error } = await admin.rpc('easyship_topup_shipping_credit', {
      p_shop_id: shopId,
      p_amount: amount,
      p_idempotency_key: key,
      p_currency: 'INR',
      p_payload: { source: 'vendor_request', user_id: userData.user.id },
    })
    if (error) return jsonResponse({ error: error.message }, 400)
    return jsonResponse({ ok: true, result: data })
  }

  const { data: credit } = await admin
    .from('easyship_shipping_credits')
    .select('balance_amount, currency, updated_at')
    .eq('shop_id', shopId)
    .maybeSingle()

  const { data: ledger } = await admin
    .from('easyship_shipping_credit_ledger')
    .select(
      'id, order_id, entry_type, amount, currency, easyship_shipment_id, created_at',
    )
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(30)

  const openStatuses = ['pending', 'confirmed', 'processing']
  const { data: openOrders } = await admin
    .from('orders')
    .select('id, shipping_amount, order_status, order_metadata')
    .eq('shop_id', shopId)
    .in('order_status', openStatuses)

  const byOrder = new Map<string, number>()
  for (const order of openOrders ?? []) {
    if (!order?.id || byOrder.has(order.id)) continue
    const meta = (order.order_metadata ?? {}) as Record<string, unknown>
    const easyship = (meta.easyship ?? {}) as Record<string, unknown>
    const amount = Number(
      easyship.shipment_charge ?? easyship.shipping_amount ?? order.shipping_amount ?? 0,
    )
    byOrder.set(order.id, Number.isFinite(amount) ? amount : 0)
  }
  const pendingCost = [...byOrder.values()].reduce((s, n) => s + n, 0)

  const balance = Number(credit?.balance_amount ?? 0)
  return jsonResponse({
    ok: true,
    shopId,
    balance,
    currency: String(credit?.currency || 'INR'),
    updatedAt: credit?.updated_at ?? null,
    pendingCost: Math.round(pendingCost * 100) / 100,
    pendingOrderCount: byOrder.size,
    lowBalance: balance <= 0 || (pendingCost > 0 && balance < pendingCost),
    rechargeUrl: EASYSHIP_SELLER_RECHARGE_PATH,
    ledger: ledger ?? [],
  })
})
