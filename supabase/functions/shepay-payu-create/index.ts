import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { resolvePublicAppOrigin } from '../_shared/app-url.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  applyPayuPaymentModeFields,
  payURequestHash,
  resolvePayuCredentials,
} from '../_shared/payu.ts'

type CreateBody = {
  payment_step_id?: string
  checkout_group_id?: string
  payment_method_id?: string | null
  /** Preferred PayU payment mode id from checkout chips */
  mode?: string | null
  /** Preferred PayU payment mode: UPI | CC | NB | CASH | … */
  pg?: string | null
  bankcode?: string | null
  /** Extra `_payment` fields (e.g. beneficiaryaccount / ifsc for NEFT) */
  extra_fields?: Record<string, string> | null
}

function formatAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const payu = resolvePayuCredentials()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appBase = resolvePublicAppOrigin()

  if (!payu || !supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'SHEPay is not configured' }, 503)
  }

  const { key, salt, baseUrl: payuBase, mode: payuMode } = payu

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
    .select('full_name, email, username, phone')
    .eq('id', user.id)
    .maybeSingle()

  const firstname =
    (profile?.full_name || profile?.username || 'Customer').split(/\s+/)[0] || 'Customer'
  const email = profile?.email || user.email || 'buyer@sheconomy.com'
  const phone = String(profile?.phone ?? user.phone ?? '').replace(/\D/g, '') || '9999999999'
  const amount = formatAmount(Number(step.amount ?? 0))
  const txnid = `shepay_${String(step.id).replace(/-/g, '').slice(0, 20)}_${Date.now().toString(36)}`
  const productinfo = `SHEPay checkout ${step.checkout_group_id}`
  const udf1 = String(step.id)
  const udf2 = String(step.shop_id ?? '')
  const udf3 = String(step.checkout_group_id ?? '')
  const udf4 = body.payment_method_id ? String(body.payment_method_id) : ''
  const udf5 = payuMode

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
    udf5,
  }
  const hash = await payURequestHash(hashParams, salt)

  const fields: Record<string, string> = {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    phone,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    hash,
    surl: `${appBase}/orders/payu-return?status=success`,
    furl: `${appBase}/orders/payu-return?status=failure`,
    service_provider: 'payu_paisa',
  }

  applyPayuPaymentModeFields(fields, {
    modeId: body.mode,
    pg: body.pg,
    bankcode: body.bankcode,
    extraFields: body.extra_fields ?? null,
  })

  const actionUrl = `${payuBase}/_payment`
  // Bridge auto-POSTs to PayU — same path for web form submit and native WebView.
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
    payu_env: payuMode,
  })
})
