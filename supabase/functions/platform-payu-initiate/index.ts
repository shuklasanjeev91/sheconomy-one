import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  buildPlatformPayuPaymentFields,
  buildPlatformPayuTxnId,
  formatPlatformPayuAmount,
  resolvePlatformPayuCredentials,
} from '../_shared/platform-payu.ts'

type InitiateBody = {
  order_id?: string
  amount?: number
  productinfo?: string
  shop_id?: string | null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const creds = resolvePlatformPayuCredentials()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!creds || !supabaseUrl || !serviceRole || !anonKey) {
    return jsonResponse({ error: 'Platform PayU is not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: InitiateBody
  try {
    body = (await request.json()) as InitiateBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const orderId = String(body.order_id ?? '').trim()
  const amount = Number(body.amount)
  const productinfo = String(body.productinfo ?? '').trim()
  const shopId = body.shop_id?.trim() || null

  if (!orderId || !isUuid(orderId)) {
    return jsonResponse({ error: 'A valid order_id is required' }, 400)
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse({ error: 'A valid amount is required' }, 400)
  }
  if (!productinfo) {
    return jsonResponse({ error: 'productinfo is required' }, 400)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, user_id, order_number, customer_total_amount, total_amount, order_status')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) return jsonResponse({ error: 'Order not found' }, 404)
  if (order.user_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)

  const orderTotal = Number(order.customer_total_amount ?? order.total_amount ?? 0)
  const formattedAmount = formatPlatformPayuAmount(amount)
  if (orderTotal > 0 && Math.abs(orderTotal - amount) > 0.02) {
    return jsonResponse({ error: 'Amount does not match order total' }, 400)
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, username, phone')
    .eq('id', user.id)
    .maybeSingle()

  const firstname =
    (profile?.full_name || profile?.username || 'Customer').split(/\s+/)[0] || 'Customer'
  const email = profile?.email || user.email || 'buyer@sheconomy.com'
  const phone = String(profile?.phone ?? user.phone ?? '').replace(/\D/g, '') || '9999999999'

  const txnid = buildPlatformPayuTxnId(orderId)

  const { data: existingPayment } = await admin
    .from('order_payments')
    .select('id, payment_status')
    .eq('order_id', orderId)
    .eq('payment_mode', 'online')
    .maybeSingle()

  let orderPaymentId: string

  if (existingPayment?.id) {
    if (existingPayment.payment_status === 'completed') {
      return jsonResponse({ error: 'Order is already paid' }, 409)
    }
    orderPaymentId = existingPayment.id
    await admin
      .from('order_payments')
      .update({
        amount,
        payment_status: 'pending',
        payment_gateway: 'payu',
        transaction_id: txnid,
        gateway_transaction_id: null,
        failure_reason: null,
        failure_code: null,
        payment_metadata: {
          provider: 'platform_payu',
          initiated_at: new Date().toISOString(),
          shop_id: shopId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderPaymentId)
  } else {
    const { data: inserted, error: insertError } = await admin
      .from('order_payments')
      .insert({
        order_id: orderId,
        amount,
        payment_mode: 'online',
        payment_status: 'pending',
        payment_gateway: 'payu',
        transaction_id: txnid,
        payment_metadata: {
          provider: 'platform_payu',
          initiated_at: new Date().toISOString(),
          shop_id: shopId,
        },
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      return jsonResponse({ error: insertError?.message ?? 'Could not create payment record' }, 500)
    }
    orderPaymentId = inserted.id
  }

  const fields = await buildPlatformPayuPaymentFields({
    creds,
    txnid,
    amount: formattedAmount,
    productinfo,
    firstname,
    email,
    phone,
    udf1: user.id,
    udf2: orderPaymentId,
    udf3: orderId,
    udf4: shopId ?? '',
    udf5: 'platform',
    supabaseUrl,
  })

  await admin.from('payment_logs').insert({
    order_payment_id: orderPaymentId,
    shop_id: shopId,
    event_type: 'authorization',
    status: 'pending',
    provider: 'payu',
    transaction_id: txnid,
    amount,
    currency: 'INR',
    payload: { action: 'initiate', txnid, order_id: orderId },
  })

  const payuUrl = `${creds.baseUrl}/_payment`
  const { hash: _hash, ...clientParams } = fields

  return jsonResponse({
    payuUrl,
    params: { ...clientParams, hash: fields.hash },
    txnid,
    order_payment_id: orderPaymentId,
    payu_env: creds.mode,
    payu_base_url: creds.baseUrl,
  })
})
