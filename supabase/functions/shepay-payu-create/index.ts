import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { payURequestHash } from '../_shared/payu.ts'

type CreateBody = {
  payment_step_id?: string
  checkout_group_id?: string
  payment_method_id?: string | null
  /** Preferred PayU payment mode: UPI | CC | NB | CASH */
  pg?: string | null
}

function formatAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const key = Deno.env.get('PAYU_MERCHANT_KEY')?.trim()
  const salt = Deno.env.get('PAYU_MERCHANT_SALT')?.trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appBase =
    Deno.env.get('PUBLIC_APP_URL')?.replace(/\/$/, '') ||
    Deno.env.get('APP_URL')?.replace(/\/$/, '') ||
    'https://sheconomy.com'
  const payuBase =
    Deno.env.get('PAYU_BASE_URL')?.replace(/\/$/, '') || 'https://test.payu.in'

  if (!key || !salt || !supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'SHEPay is not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const paymentStepId = String(body.payment_step_id ?? '')
  if (!paymentStepId) return jsonResponse({ error: 'payment_step_id required' }, 400)

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
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

  const { data: step, error: stepError } = await admin
    .from('commerce_checkout_payment_steps')
    .select('id, checkout_group_id, shop_id, amount, collection, status, provider')
    .eq('id', paymentStepId)
    .maybeSingle()

  if (stepError || !step) return jsonResponse({ error: 'Payment step not found' }, 404)
  if (step.collection !== 'shepay' && step.collection !== 'cod') {
    // still allow shepay collection only
  }
  if (String(step.collection) !== 'shepay') {
    return jsonResponse({ error: 'Step is not a SHEPay collection' }, 400)
  }

  const { data: group } = await admin
    .from('commerce_checkout_groups')
    .select('id, buyer_id')
    .eq('id', step.checkout_group_id)
    .maybeSingle()

  if (!group || group.buyer_id !== user.id) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, username')
    .eq('id', user.id)
    .maybeSingle()

  const firstname =
    (profile?.full_name || profile?.username || 'Customer').split(/\s+/)[0] || 'Customer'
  const email = profile?.email || user.email || 'buyer@sheconomy.com'
  const amount = formatAmount(Number(step.amount ?? 0))
  const txnid = `shepay_${String(step.id).replace(/-/g, '').slice(0, 20)}_${Date.now().toString(36)}`
  const productinfo = `SHEPay checkout ${step.checkout_group_id}`
  const udf1 = String(step.id)
  const udf2 = String(step.shop_id ?? '')
  const udf3 = String(step.checkout_group_id ?? '')
  const udf4 = body.payment_method_id ? String(body.payment_method_id) : ''

  const hashParams = {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
  }
  const hash = await payURequestHash(hashParams, salt)

  const fields: Record<string, string> = {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    hash,
    surl: `${appBase}/orders/payu-return?status=success`,
    furl: `${appBase}/orders/payu-return?status=failure`,
    service_provider: 'payu_paisa',
  }

  const pg = body.pg ? String(body.pg).trim().toUpperCase() : ''
  if (pg && ['UPI', 'CC', 'DC', 'NB', 'CASH', 'EMI'].includes(pg)) {
    fields.pg = pg
  }

  const actionUrl = `${payuBase}/_payment`
  // Bridge page auto-POSTs fields (merchant-hosted / form post flow).
  const bridgeParams = new URLSearchParams({
    action: actionUrl,
    payload: JSON.stringify(fields),
  })
  const checkoutUrl = `${appBase}/orders/payu?${bridgeParams.toString()}`

  await admin
    .from('commerce_checkout_payment_steps')
    .update({
      checkout_url: checkoutUrl,
      provider: 'payu',
      provider_reference: txnid,
      status: 'requires_action',
      updated_at: new Date().toISOString(),
    })
    .eq('id', step.id)

  return jsonResponse({
    checkout_url: checkoutUrl,
    action_url: actionUrl,
    fields,
    txnid,
    payment_step_id: step.id,
  })
})
