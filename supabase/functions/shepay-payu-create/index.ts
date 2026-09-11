import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { resolvePublicAppOrigin } from '../_shared/app-url.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  applyPayuPaymentModeFields,
  classifyPayuS2sResponse,
  payURequestHash,
  payuModeNeedsS2s,
  payuSeamlessPaymentPost,
  resolvePayuCredentials,
  sanitizePayuFieldsForClient,
} from '../_shared/payu.ts'

type CardBody = {
  number?: string
  name?: string
  exp_mon?: string
  exp_yr?: string
  cvv?: string
  /** From getBinInfo card_type (VISA/MAST/…) — falls back to CC */
  bankcode?: string | null
}

type CreateBody = {
  payment_step_id?: string
  checkout_group_id?: string
  payment_method_id?: string | null
  mode?: string | null
  pg?: string | null
  bankcode?: string | null
  extra_fields?: Record<string, string> | null
  inline?: boolean | null
  seamless?: boolean | null
  /** `hosted` (default) = PayU Hosted Checkout. `s2s` = Merchant Hosted / S2S. */
  checkout_style?: 'hosted' | 'payu_hosted' | 's2s' | 'merchant_hosted' | null
  client_ip?: string | null
  device_info?: string | null
  /** Merchant-hosted card fields — never persisted */
  card?: CardBody | null
  /** 3DS2 browserInfo JSON string or object */
  three_ds2_request_data?: string | Record<string, unknown> | null
}

function formatAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2)
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
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
    .select('id, checkout_group_id, shop_id, amount, collection, status, provider, kind, metadata')
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
  // Bundle charge: shop_id is null — use "bundle" so webhook can still resolve the step by udf1.
  const udf2 = String(step.shop_id ?? 'bundle')
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

  const checkoutStyle = String(
    body.checkout_style ?? Deno.env.get('PAYU_CHECKOUT_STYLE') ?? 'hosted',
  )
    .trim()
    .toLowerCase()
  const usePayuHosted =
    checkoutStyle === 'hosted' ||
    checkoutStyle === 'payu_hosted' ||
    // Explicit client opt-in
    String(body.mode ?? '').toLowerCase() === 'hosted'

  const seamless = usePayuHosted ? false : body.seamless !== false
  const inline = !seamless && body.inline !== false
  const embedQuery = inline ? '&embed=1' : ''

  // PayU POSTs to surl/furl — use edge bridge (accepts POST) then 303 → SPA GET page.
  // Include checkout group id so failure can restore the cart without browser session storage.
  const payuReturnBase = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/shepay-payu-return`
  const cgQuery = `&cg=${encodeURIComponent(String(step.checkout_group_id))}`

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
    surl: `${payuReturnBase}?status=success${embedQuery}${cgQuery}`,
    furl: `${payuReturnBase}?status=failure${embedQuery}${cgQuery}`,
    service_provider: 'payu_paisa',
  }

  const actionUrl = `${payuBase}/_payment`

  /**
   * PayU Hosted Checkout — omit pg/bankcode so the buyer chooses methods on
   * PayU's page (only banks/methods enabled for this MID appear).
   * @see https://docs.payu.in/docs/prebuilt-checkout-payu-hosted
   */
  if (usePayuHosted) {
    const safeFields = sanitizePayuFieldsForClient(fields)
    const bridgeParams = new URLSearchParams({
      action: actionUrl,
      payload: JSON.stringify(safeFields),
    })
    const checkoutUrl = `${appBase}/orders/payu?${bridgeParams.toString()}`

    await admin
      .from('commerce_checkout_payment_steps')
      .update({
        checkout_url: checkoutUrl,
        provider: 'payu',
        provider_reference: txnid,
        status: 'requires_action',
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', step.id)

    return jsonResponse({
      flow: 'form_post',
      outcome: 'redirect',
      checkout_url: checkoutUrl,
      action_url: actionUrl,
      fields: safeFields,
      txnid,
      payment_step_id: step.id,
      payu_env: payuMode,
      message: 'Continue on the secure payment page',
    })
  }

  applyPayuPaymentModeFields(fields, {
    modeId: body.mode,
    pg: body.pg,
    bankcode: body.bankcode,
    extraFields: body.extra_fields ?? null,
  })

  const vpa = body.extra_fields?.vpa?.trim()
  if (vpa) {
    fields.vpa = vpa
    if (!fields.pg) fields.pg = 'UPI'
    if (!fields.bankcode) fields.bankcode = 'UPI'
  }

  const modeKey = String(body.mode ?? 'all').trim().toLowerCase()
  const isCard = modeKey === 'cards' || fields.pg === 'CC' || fields.pg === 'DC'
  const card = body.card

  if (isCard) {
    const ccnum = digitsOnly(String(card?.number ?? ''))
    const ccname = String(card?.name ?? '').trim()
    const ccexpmon = digitsOnly(String(card?.exp_mon ?? '')).padStart(2, '0').slice(0, 2)
    let ccexpyr = digitsOnly(String(card?.exp_yr ?? ''))
    if (ccexpyr.length === 2) ccexpyr = `20${ccexpyr}`
    const ccvv = digitsOnly(String(card?.cvv ?? ''))

    if (ccnum.length < 13 || ccnum.length > 19) {
      return jsonResponse({ error: 'Enter a valid card number' }, 400)
    }
    if (!ccname) return jsonResponse({ error: 'Enter the name on the card' }, 400)
    if (!ccexpmon || Number(ccexpmon) < 1 || Number(ccexpmon) > 12) {
      return jsonResponse({ error: 'Enter a valid expiry month (MM)' }, 400)
    }
    if (ccexpyr.length !== 4) return jsonResponse({ error: 'Enter a valid expiry year (YYYY)' }, 400)
    if (ccvv.length < 3 || ccvv.length > 4) {
      return jsonResponse({ error: 'Enter a valid CVV' }, 400)
    }

    // Merchant-hosted S2S sample uses pg/bankcode=CC without service_provider.
    delete fields.service_provider
    fields.pg = 'CC'
    fields.bankcode = 'CC'
    const isDebitHint =
      String(card?.bankcode || body.bankcode || '').trim().toUpperCase() === 'DC' ||
      String(body.extra_fields?.category ?? '').toLowerCase().includes('debit')
    if (isDebitHint) fields.pg = 'DC'
    fields.ccnum = ccnum
    fields.ccname = ccname
    fields.ccexpmon = ccexpmon
    fields.ccexpyr = ccexpyr
    fields.ccvv = ccvv

    const forwardedEarly = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const earlyIp =
      String(body.client_ip ?? '').trim() ||
      forwardedEarly ||
      request.headers.get('cf-connecting-ip')?.trim() ||
      '1.2.3.4'
    const safeIp = earlyIp === '127.0.0.1' || earlyIp === '::1' ? '1.2.3.4' : earlyIp

    let threeDsPayload: Record<string, unknown> | null = null
    if (body.three_ds2_request_data) {
      if (typeof body.three_ds2_request_data === 'string') {
        try {
          threeDsPayload = JSON.parse(body.three_ds2_request_data) as Record<string, unknown>
        } catch {
          threeDsPayload = null
        }
      } else {
        threeDsPayload = body.three_ds2_request_data as Record<string, unknown>
      }
    }
    const browserInfo = {
      userAgent: String(body.device_info ?? request.headers.get('user-agent') ?? 'Mozilla/5.0'),
      acceptHeader: 'text/html',
      language: 'en-US',
      colorDepth: '24',
      screenHeight: '900',
      screenWidth: '1440',
      timeZone: '-330',
      javaEnabled: true,
      ip: safeIp,
      ...((threeDsPayload?.browserInfo as Record<string, unknown> | undefined) ?? {}),
    }
    if (!browserInfo.ip || browserInfo.ip === '127.0.0.1' || browserInfo.ip === '::1') {
      browserInfo.ip = safeIp
    }
    fields.threeDS2RequestData = JSON.stringify({ browserInfo })
  }

  const pgUpper = String(fields.pg ?? '').toUpperCase()
  const classicMhcPg = ['NB', 'CASH', 'EMI', 'BNPL', 'PAYPAL', 'MC', 'NEFTRTGS'].includes(pgUpper)
  const useS2s = seamless && payuModeNeedsS2s(modeKey) && !classicMhcPg

  // MHC / S2S must not send PayU-hosted `service_provider` (forces Payment Page).
  delete fields.service_provider

  /**
   * Record which method was attempted — `provider` alone is just "payu", so a
   * failed step otherwise can't be traced back to a bank or wallet.
   */
  function metadataWithMethod(extra?: Record<string, unknown>): Record<string, unknown> {
    const priorMeta =
      step.metadata && typeof step.metadata === 'object'
        ? (step.metadata as Record<string, unknown>)
        : {}
    return {
      ...priorMeta,
      payment_method: {
        mode: modeKey,
        pg: fields.pg ?? null,
        bankcode: fields.bankcode ?? null,
        flow: useS2s ? 's2s' : 'form_post',
        attempted_at: new Date().toISOString(),
      },
      ...(extra ?? {}),
    }
  }

  if (useS2s) {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const clientIp =
      String(body.client_ip ?? '').trim() ||
      forwarded ||
      request.headers.get('cf-connecting-ip')?.trim() ||
      '127.0.0.1'
    const deviceInfo =
      String(body.device_info ?? '').trim() ||
      request.headers.get('user-agent')?.trim() ||
      'Mozilla/5.0'

    fields.txn_s2s_flow = '4'
    fields.s2s_client_ip =
      clientIp === '127.0.0.1' || clientIp === '::1' ? '1.2.3.4' : clientIp
    fields.s2s_device_info = deviceInfo
  }

  const safeFields = sanitizePayuFieldsForClient(fields)
  const bridgeParams = new URLSearchParams({
    action: actionUrl,
    payload: JSON.stringify(safeFields),
  })
  const checkoutUrl = `${appBase}/orders/payu?${bridgeParams.toString()}`

  await admin
    .from('commerce_checkout_payment_steps')
    .update({
      checkout_url: checkoutUrl,
      provider: 'payu',
      provider_reference: txnid,
      status: 'requires_action',
      metadata: metadataWithMethod(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', step.id)

  if (!useS2s) {
    return jsonResponse({
      flow: 'form_post',
      checkout_url: checkoutUrl,
      action_url: actionUrl,
      fields: safeFields,
      txnid,
      payment_step_id: step.id,
      payu_env: payuMode,
    })
  }

  /** App-specific UPI bankcodes often fail on web / test — fall back to generic INTENT QR. */
  const UPI_APP_BANKCODES = new Set(['TEZ', 'PHONEPE', 'PAYTM'])

  async function refreshTxnAndHash(nextFields: Record<string, string>): Promise<string> {
    const nextTxnid = `shepay_${String(step.id).replace(/-/g, '').slice(0, 20)}_${Date.now().toString(36)}`
    nextFields.txnid = nextTxnid
    nextFields.hash = await payURequestHash(
      {
        key,
        txnid: nextTxnid,
        amount,
        productinfo,
        firstname,
        email,
        udf1,
        udf2,
        udf3,
        udf4,
        udf5,
      },
      salt,
    )
    return nextTxnid
  }

  let activeTxnid = txnid
  let posted = await payuSeamlessPaymentPost(actionUrl, fields)
  let outcome = classifyPayuS2sResponse(posted.json, posted.text)

  if (
    outcome.kind === 'failure' &&
    UPI_APP_BANKCODES.has(String(fields.bankcode ?? '').toUpperCase())
  ) {
    fields.bankcode = 'INTENT'
    delete fields.upiAppName
    activeTxnid = await refreshTxnAndHash(fields)
    await admin
      .from('commerce_checkout_payment_steps')
      .update({
        provider_reference: activeTxnid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', step.id)
    posted = await payuSeamlessPaymentPost(actionUrl, fields)
    outcome = classifyPayuS2sResponse(posted.json, posted.text)
  }

  // Cards: if 3DS2 S2S fails with EX*, retry classic seamless without threeDS2RequestData.
  if (isCard && outcome.kind === 'failure') {
    const msg = outcome.message.toUpperCase()
    if (msg.includes('EX413') || msg.includes('EX1') || msg.includes('AUTHENTICATION')) {
      delete fields.threeDS2RequestData
      if (fields.s2s_client_ip === '127.0.0.1' || fields.s2s_client_ip === '::1') {
        fields.s2s_client_ip = '1.2.3.4'
      }
      activeTxnid = await refreshTxnAndHash(fields)
      await admin
        .from('commerce_checkout_payment_steps')
        .update({
          provider_reference: activeTxnid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', step.id)
      posted = await payuSeamlessPaymentPost(actionUrl, fields)
      outcome = classifyPayuS2sResponse(posted.json, posted.text)
    }
  }

  const clientSafeFields = sanitizePayuFieldsForClient(fields)

  if (outcome.kind === 'failure') {
    const gatewayCode = outcome.message.match(/\bEX\d+\b/i)?.[0]?.toUpperCase() ?? null

    await admin
      .from('commerce_checkout_payment_steps')
      .update({
        last_error: outcome.message.slice(0, 500),
        status: 'requires_action',
        metadata: metadataWithMethod({
          last_failure: {
            code: gatewayCode,
            message: outcome.message.slice(0, 500),
            unmapped_status: outcome.unmapped || null,
            at: new Date().toISOString(),
          },
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', step.id)

    return jsonResponse(
      {
        error: outcome.message,
        flow: 's2s',
        outcome: outcome.kind,
        txnid: activeTxnid,
        payment_step_id: step.id,
        payu_env: payuMode,
        unmapped_status: outcome.unmapped,
      },
      502,
    )
  }

  if (outcome.kind === 'success') {
    await admin
      .from('commerce_checkout_payment_steps')
      .update({
        status: 'processing',
        provider_reference: outcome.payuId ?? activeTxnid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', step.id)
  }

  return jsonResponse({
    flow: 's2s',
    outcome: outcome.kind,
    checkout_url: checkoutUrl,
    action_url: actionUrl,
    fields: clientSafeFields,
    txnid: activeTxnid,
    payment_step_id: step.id,
    payu_env: payuMode,
    intent_uri: outcome.kind === 'upi_intent' ? outcome.intentUri : null,
    acs_html: outcome.kind === 'acs' ? outcome.acsHtml : null,
    redirect_url: outcome.kind === 'redirect' ? outcome.url : null,
    payu_id: 'payuId' in outcome ? outcome.payuId : null,
    unmapped_status: outcome.unmapped,
    message: outcome.kind === 'pending' ? outcome.message : null,
  })
})
