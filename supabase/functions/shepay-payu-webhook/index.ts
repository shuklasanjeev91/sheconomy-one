import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '~/supabase/functions/_shared/cors.ts'
import { payUResponseHash } from '~/supabase/functions/_shared/payu.ts'

function pick(form: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    if (form[key] != null && String(form[key]).length) return String(form[key])
  }
  return ''
}

async function parseBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = (await request.json()) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(json)) out[k] = String(v ?? '')
    return out
  }
  const text = await request.text()
  const params = new URLSearchParams(text)
  const out: Record<string, string> = {}
  for (const [k, v] of params.entries()) out[k] = v
  return out
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
  if (!key || !salt || !supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'SHEPay webhook not configured' }, 503)
  }

  const form = await parseBody(request)
  const status = pick(form, 'status')
  const txnid = pick(form, 'txnid')
  const amount = pick(form, 'amount')
  const productinfo = pick(form, 'productinfo')
  const firstname = pick(form, 'firstname')
  const email = pick(form, 'email')
  const udf1 = pick(form, 'udf1')
  const udf2 = pick(form, 'udf2')
  const udf3 = pick(form, 'udf3')
  const udf4 = pick(form, 'udf4')
  const udf5 = pick(form, 'udf5')
  const hash = pick(form, 'hash')
  const mihpayid = pick(form, 'mihpayid')

  if (!status || !txnid || !udf1 || !hash) {
    return jsonResponse({ error: 'Missing PayU fields' }, 400)
  }

  const expected = await payUResponseHash(
    {
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
      status,
    },
    salt,
  )

  if (expected.toLowerCase() !== hash.toLowerCase()) {
    return jsonResponse({ error: 'Invalid PayU hash' }, 401)
  }

  const mappedStatus =
    status.toLowerCase() === 'success'
      ? 'paid'
      : status.toLowerCase() === 'failure' || status.toLowerCase() === 'failed'
        ? 'failed'
        : status.toLowerCase() === 'pending'
          ? 'processing'
          : 'processing'

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin.rpc('process_checkout_payment_webhook', {
    p_payment_step_id: udf1,
    p_shop_id: udf2 || null,
    p_provider: 'payu',
    p_webhook_id: mihpayid || `${txnid}:${status}`,
    p_event_type: `payu.${status}`,
    p_status: mappedStatus,
    p_provider_reference: mihpayid || txnid,
    p_payload: form,
  })

  if (error) return jsonResponse({ error: error.message }, 500)
  return jsonResponse({ ok: true, result: data })
})
