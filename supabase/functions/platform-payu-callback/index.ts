import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders } from '../_shared/cors.ts'
import {
  mapPayuStatusToLogEvent,
  mapPayuStatusToLogStatus,
  mapPayuStatusToPaymentStatus,
  parsePayuFormBody,
  platformPayuAppRedirect,
  collectPlatformPayuCredentialCandidates,
  matchPlatformPayuCredentials,
} from '../_shared/platform-payu.ts'

async function applyPlatformPayuResult(
  admin: SupabaseClient,
  form: Record<string, string>,
  tampered: boolean,
): Promise<{ orderPaymentId: string | null; txnid: string }> {
  const txnid = String(form.txnid ?? '')
  const payuStatus = String(form.status ?? '')
  const mihpayid = String(form.mihpayid ?? form.payuId ?? form.payu_id ?? '')
  const orderPaymentId = String(form.udf2 ?? '')
  const errorMessage = String(form.error_Message ?? form.error_message ?? form.field9 ?? '')

  if (tampered) {
    if (orderPaymentId) {
      await admin.from('payment_logs').insert({
        order_payment_id: orderPaymentId,
        shop_id: form.udf4?.trim() || null,
        event_type: 'failure',
        status: 'failed',
        provider: 'payu',
        transaction_id: txnid || null,
        amount: form.amount ? Number(form.amount) : null,
        currency: 'INR',
        error_code: 'TAMPERED_HASH',
        error_message: 'PayU response hash verification failed',
        payload: form,
      })
    }
    return { orderPaymentId: orderPaymentId || null, txnid }
  }

  const paymentStatus = mapPayuStatusToPaymentStatus(payuStatus)
  const now = new Date().toISOString()

  const updates: Record<string, unknown> = {
    payment_status: paymentStatus,
    transaction_id: txnid || undefined,
    gateway_transaction_id: mihpayid || undefined,
    payment_metadata: {
      provider: 'platform_payu',
      payu_response: form,
      processed_via: 'callback',
    },
    updated_at: now,
  }

  if (paymentStatus === 'completed') {
    updates.processed_at = now
    updates.failure_reason = null
    updates.failure_code = null
  } else if (paymentStatus === 'failed') {
    updates.failure_reason = errorMessage || 'Payment failed'
    updates.failure_code = String(form.error ?? form.status ?? 'failed')
  }

  if (orderPaymentId) {
    await admin.from('order_payments').update(updates).eq('id', orderPaymentId)
  } else if (txnid) {
    await admin.from('order_payments').update(updates).eq('transaction_id', txnid)
  }

  if (paymentStatus === 'completed' && form.udf3) {
    await admin
      .from('orders')
      .update({
        order_status: 'confirmed',
        confirmed_at: now,
        updated_at: now,
      })
      .eq('id', form.udf3)
      .in('order_status', ['pending', 'awaiting_payment'])
  }

  await admin.from('payment_logs').insert({
    order_payment_id: orderPaymentId || null,
    shop_id: form.udf4?.trim() || null,
    event_type: mapPayuStatusToLogEvent(payuStatus),
    status: mapPayuStatusToLogStatus(payuStatus),
    provider: 'payu',
    transaction_id: txnid || null,
    amount: form.amount ? Number(form.amount) : null,
    currency: 'INR',
    error_code: paymentStatus === 'failed' ? String(form.error ?? 'failed') : null,
    error_message: paymentStatus === 'failed' ? errorMessage || null : null,
    payload: form,
    processed_at: paymentStatus === 'completed' ? now : null,
  })

  return { orderPaymentId: orderPaymentId || null, txnid }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const candidates = collectPlatformPayuCredentialCandidates()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!candidates.length || !supabaseUrl || !serviceRole) {
    return new Response('Platform PayU not configured', { status: 503, headers: corsHeaders })
  }

  const url = new URL(request.url)
  const statusHint = url.searchParams.get('status')?.toLowerCase()
  const embed =
    url.searchParams.get('embed') === '1' ||
    url.searchParams.get('embed')?.toLowerCase() === 'true'

  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  let form: Record<string, string> = {}
  if (request.method === 'POST') {
    form = await parsePayuFormBody(request)
  } else {
    for (const [k, v] of url.searchParams.entries()) {
      if (k !== 'status') form[k] = v
    }
    if (!form.status && statusHint) form.status = statusHint
  }

  const matched = await matchPlatformPayuCredentials(form, candidates)
  const tampered = matched == null
  const txnid = String(form.txnid ?? '')

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (tampered) {
    await applyPlatformPayuResult(admin, form, true)
    return new Response(null, {
      status: 303,
      headers: {
        ...corsHeaders,
        Location: platformPayuAppRedirect('failure', txnid, 'tampered', { embed }),
        'Cache-Control': 'no-store',
      },
    })
  }

  await applyPlatformPayuResult(admin, form, false)

  const payuStatus = String(form.status ?? statusHint ?? '').toLowerCase()
  const ok = payuStatus === 'success'
  const reason = String(form.error_Message ?? form.error_message ?? form.field9 ?? '')

  return new Response(null, {
    status: 303,
    headers: {
      ...corsHeaders,
      Location: platformPayuAppRedirect(ok ? 'success' : 'failure', txnid, reason, { embed }),
      'Cache-Control': 'no-store',
    },
  })
})
