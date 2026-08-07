import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { payuMerchantCommand } from '../_shared/payu.ts'
import { resolvePlatformPayuCredentials } from '../_shared/platform-payu.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const creds = resolvePlatformPayuCredentials()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!creds || !supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Platform PayU is not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: { txnid?: string; order_payment_id?: string }
  try {
    body = (await request.json()) as { txnid?: string; order_payment_id?: string }
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const txnid = String(body.txnid ?? '').trim()
  const orderPaymentId = String(body.order_payment_id ?? '').trim()
  if (!txnid && !orderPaymentId) {
    return jsonResponse({ error: 'txnid or order_payment_id required' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let resolvedTxn = txnid
  if (orderPaymentId) {
    const { data: payment } = await admin
      .from('order_payments')
      .select('id, transaction_id, order_id')
      .eq('id', orderPaymentId)
      .maybeSingle()
    if (!payment) return jsonResponse({ error: 'Payment record not found' }, 404)

    const { data: order } = await admin
      .from('orders')
      .select('user_id')
      .eq('id', payment.order_id)
      .maybeSingle()
    if (!order || order.user_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)

    if (!resolvedTxn && payment.transaction_id) resolvedTxn = String(payment.transaction_id)
  }

  if (!resolvedTxn) return jsonResponse({ error: 'Transaction id required' }, 400)

  const posted = await payuMerchantCommand(creds, 'verify_payment', { var1: resolvedTxn })
  const txn = (posted.json?.transaction_details ?? posted.json ?? {}) as Record<string, unknown>
  const row =
    txn[resolvedTxn] && typeof txn[resolvedTxn] === 'object'
      ? (txn[resolvedTxn] as Record<string, unknown>)
      : txn

  const status = String(row.status ?? posted.json?.status ?? '').toLowerCase()
  const success = status === 'success'
  const mihpayid = String(row.mihpayid ?? row.mihpayId ?? '')

  return jsonResponse({
    txnid: resolvedTxn,
    success,
    status: status || 'unknown',
    mihpayid: mihpayid || null,
  })
})
