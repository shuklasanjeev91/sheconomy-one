import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { payuMerchantCommand, resolvePayuCredentials } from '../_shared/payu.ts'

/**
 * PayU verify_payment — Step 4 of merchant-hosted cards / S2S.
 * @see https://docs.payu.in/docs/collect-payments-with-cards-seamless
 */
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const payu = resolvePayuCredentials()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!payu || !supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'SHEPay is not configured' }, 503)
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

  let body: { txnid?: string; payment_step_id?: string }
  try {
    body = (await request.json()) as { txnid?: string; payment_step_id?: string }
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const txnid = String(body.txnid ?? '').trim()
  const paymentStepId = String(body.payment_step_id ?? '').trim()
  if (!txnid && !paymentStepId) {
    return jsonResponse({ error: 'txnid or payment_step_id required' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let resolvedTxn = txnid
  let stepId = paymentStepId

  if (paymentStepId) {
    const { data: step } = await admin
      .from('commerce_checkout_payment_steps')
      .select('id, checkout_group_id, provider_reference')
      .eq('id', paymentStepId)
      .maybeSingle()
    if (!step) return jsonResponse({ error: 'Payment step not found' }, 404)

    const { data: group } = await admin
      .from('commerce_checkout_groups')
      .select('buyer_id')
      .eq('id', step.checkout_group_id)
      .maybeSingle()
    if (!group || group.buyer_id !== user.id) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    stepId = step.id
    if (!resolvedTxn) resolvedTxn = String(step.provider_reference ?? '')
  }

  if (!resolvedTxn) return jsonResponse({ error: 'txnid required' }, 400)

  const posted = await payuMerchantCommand(payu, 'verify_payment', { var1: resolvedTxn })
  const transactionDetails = posted.json?.transaction_details as
    | Record<string, Record<string, unknown>>
    | undefined
  const details = (transactionDetails?.[resolvedTxn] ??
    transactionDetails ??
    posted.json ??
    {}) as Record<string, unknown>
  const status = String(details.status ?? details.unmappedstatus ?? posted.json?.status ?? '')
    .toLowerCase()
  const success = status === 'success' || status === 'captured' || status === 'auth'

  if (success && stepId) {
    await admin
      .from('commerce_checkout_payment_steps')
      .update({
        status: 'paid',
        provider_reference: String(details.mihpayid ?? details.payuId ?? resolvedTxn),
        updated_at: new Date().toISOString(),
      })
      .eq('id', stepId)
  }

  return jsonResponse({
    txnid: resolvedTxn,
    success,
    status,
    amount: details.amt ?? details.amount ?? null,
    mihpayid: details.mihpayid ?? null,
    mode: details.mode ?? null,
    payu_env: payu.mode,
    payment_step_id: stepId || null,
  })
})
