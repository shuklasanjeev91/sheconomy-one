import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  applyPayuPaymentModeFields,
  classifyPayuS2sResponse,
  payURequestHash,
  payuModeNeedsS2s,
  payuSeamlessPaymentPost,
  sanitizePayuFieldsForClient,
} from '../_shared/payu.ts'
import {
  formatPlatformPayuAmount,
  resolvePlatformPayuCredentials,
} from '../_shared/platform-payu.ts'

type CardBody = {
  number?: string
  name?: string
  exp_mon?: string
  exp_yr?: string
  cvv?: string
  bankcode?: string | null
}

type ChargeBody = {
  order_payment_id?: string
  mode?: string | null
  pg?: string | null
  bankcode?: string | null
  extra_fields?: Record<string, string> | null
  client_ip?: string | null
  device_info?: string | null
  card?: CardBody | null
  three_ds2_request_data?: string | Record<string, unknown> | null
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

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

  const { key, salt, baseUrl: payuBase, mode: payuMode } = creds

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: ChargeBody
  try {
    body = (await request.json()) as ChargeBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const orderPaymentId = String(body.order_payment_id ?? '').trim()
  if (!orderPaymentId) return jsonResponse({ error: 'order_payment_id required' }, 400)

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

  const { data: payment, error: paymentError } = await admin
    .from('order_payments')
    .select('id, order_id, amount, payment_status, transaction_id, payment_metadata')
    .eq('id', orderPaymentId)
    .maybeSingle()

  if (paymentError || !payment) return jsonResponse({ error: 'Payment record not found' }, 404)
  if (payment.payment_status === 'completed') {
    return jsonResponse({ error: 'Order is already paid' }, 409)
  }

  const meta =
    payment.payment_metadata && typeof payment.payment_metadata === 'object'
      ? (payment.payment_metadata as Record<string, unknown>)
      : {}
  if (meta.provider !== 'platform_payu') {
    return jsonResponse({ error: 'Not a Platform PayU payment' }, 400)
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, user_id, order_number, customer_total_amount, total_amount')
    .eq('id', payment.order_id)
    .maybeSingle()

  if (orderError || !order) return jsonResponse({ error: 'Order not found' }, 404)
  if (order.user_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, username, phone')
    .eq('id', user.id)
    .maybeSingle()

  const firstname =
    (profile?.full_name || profile?.username || 'Customer').split(/\s+/)[0] || 'Customer'
  const email = profile?.email || user.email || 'buyer@sheconomy.com'
  const phone = String(profile?.phone ?? user.phone ?? '').replace(/\D/g, '') || '9999999999'
  const amount = formatPlatformPayuAmount(Number(payment.amount ?? order.customer_total_amount ?? order.total_amount ?? 0))
  const txnid =
    String(payment.transaction_id ?? '').trim() ||
    `TXN_${String(order.id).replace(/-/g, '').slice(0, 12)}_${Date.now().toString(36)}`
  const productinfo = order.order_number ? `Order ${order.order_number}` : 'Sheconomy order'
  const shopId = typeof meta.shop_id === 'string' ? meta.shop_id : ''
  const udf1 = user.id
  const udf2 = orderPaymentId
  const udf3 = String(order.id)
  const udf4 = shopId
  const udf5 = 'platform'

  const hash = await payURequestHash(
    { key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5 },
    salt,
  )

  const callbackBase = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/platform-payu-callback`
  const actionUrl = `${payuBase}/_payment`

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
    surl: `${callbackBase}?status=success&embed=1`,
    furl: `${callbackBase}?status=failure&embed=1`,
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

  const modeKey = String(body.mode ?? 'upi_intent').trim().toLowerCase()
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
  const useS2s = payuModeNeedsS2s(modeKey) && !classicMhcPg

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

  if (!fields.pg || !fields.bankcode) {
    return jsonResponse({ error: 'Select a payment method before paying' }, 400)
  }

  async function refreshTxnAndHash(nextFields: Record<string, string>): Promise<string> {
    const nextTxnid = `TXN_${String(order!.id).replace(/-/g, '').slice(0, 12)}_${Date.now().toString(36)}`
    nextFields.txnid = nextTxnid
    nextFields.hash = await payURequestHash(
      { key, txnid: nextTxnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5 },
      salt,
    )
    return nextTxnid
  }

  let activeTxnid = txnid
  let posted = useS2s
    ? await payuSeamlessPaymentPost(actionUrl, fields)
    : { json: null as Record<string, unknown> | null, text: '' }

  let outcome = useS2s
    ? classifyPayuS2sResponse(posted.json, posted.text)
    : { kind: 'form_post' as const }

  const UPI_APP_BANKCODES = new Set(['TEZ', 'PHONEPE', 'PAYTM'])

  if (
    useS2s &&
    outcome.kind === 'failure' &&
    UPI_APP_BANKCODES.has(String(fields.bankcode ?? '').toUpperCase())
  ) {
    fields.bankcode = 'INTENT'
    delete fields.upiAppName
    activeTxnid = await refreshTxnAndHash(fields)
    await admin
      .from('order_payments')
      .update({ transaction_id: activeTxnid, updated_at: new Date().toISOString() })
      .eq('id', orderPaymentId)
    posted = await payuSeamlessPaymentPost(actionUrl, fields)
    outcome = classifyPayuS2sResponse(posted.json, posted.text)
  }

  if (useS2s && isCard && outcome.kind === 'failure') {
    const msg = outcome.message.toUpperCase()
    if (msg.includes('EX413') || msg.includes('EX1') || msg.includes('AUTHENTICATION')) {
      delete fields.threeDS2RequestData
      if (fields.s2s_client_ip === '127.0.0.1' || fields.s2s_client_ip === '::1') {
        fields.s2s_client_ip = '1.2.3.4'
      }
      activeTxnid = await refreshTxnAndHash(fields)
      await admin
        .from('order_payments')
        .update({ transaction_id: activeTxnid, updated_at: new Date().toISOString() })
        .eq('id', orderPaymentId)
      posted = await payuSeamlessPaymentPost(actionUrl, fields)
      outcome = classifyPayuS2sResponse(posted.json, posted.text)
    }
  }

  if (!useS2s) {
    const safeFields = sanitizePayuFieldsForClient(fields)
    await admin
      .from('order_payments')
      .update({
        transaction_id: activeTxnid,
        payment_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderPaymentId)

    return jsonResponse({
      flow: 'form_post',
      outcome: 'redirect',
      action_url: actionUrl,
      fields: safeFields,
      txnid: activeTxnid,
      order_payment_id: orderPaymentId,
      payu_env: payuMode,
    })
  }

  if (outcome.kind === 'failure') {
    await admin
      .from('order_payments')
      .update({
        failure_reason: outcome.message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderPaymentId)

    return jsonResponse(
      {
        error: outcome.message,
        flow: 's2s',
        outcome: outcome.kind,
        txnid: activeTxnid,
        order_payment_id: orderPaymentId,
        payu_env: payuMode,
        unmapped_status: outcome.unmapped,
      },
      502,
    )
  }

  await admin
    .from('order_payments')
    .update({
      transaction_id: activeTxnid,
      payment_status: outcome.kind === 'success' ? 'processing' : 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderPaymentId)

  const clientSafeFields = sanitizePayuFieldsForClient(fields)

  return jsonResponse({
    flow: 's2s',
    outcome: outcome.kind,
    action_url: actionUrl,
    fields: clientSafeFields,
    txnid: activeTxnid,
    order_payment_id: orderPaymentId,
    payu_env: payuMode,
    intent_uri: outcome.kind === 'upi_intent' ? outcome.intentUri : null,
    acs_html: outcome.kind === 'acs' ? outcome.acsHtml : null,
    redirect_url: outcome.kind === 'redirect' ? outcome.url : null,
    payu_id: 'payuId' in outcome ? outcome.payuId : null,
    unmapped_status: outcome.unmapped,
    message: outcome.kind === 'pending' ? outcome.message : null,
  })
})
