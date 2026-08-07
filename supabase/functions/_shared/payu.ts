/**
 * PayU hash + payment-mode helpers for edge functions.
 * Mirrors commerce/lib/payu-hash.ts and commerce/lib/payu-payment-modes.ts.
 */

export type PayUHashParams = {
  key: string
  txnid: string
  amount: string
  productinfo: string
  firstname: string
  email: string
  udf1?: string
  udf2?: string
  udf3?: string
  udf4?: string
  udf5?: string
}

export function buildPayUHashString(params: PayUHashParams, salt: string): string {
  return [
    params.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    params.udf1 ?? '',
    params.udf2 ?? '',
    params.udf3 ?? '',
    params.udf4 ?? '',
    params.udf5 ?? '',
    '',
    '',
    '',
    '',
    '',
    salt,
  ].join('|')
}

export function buildPayUReverseHashString(
  params: PayUHashParams & { status: string },
  salt: string,
): string {
  return [
    salt,
    params.status,
    '',
    '',
    '',
    '',
    '',
    params.udf5 ?? '',
    params.udf4 ?? '',
    params.udf3 ?? '',
    params.udf2 ?? '',
    params.udf1 ?? '',
    params.email,
    params.firstname,
    params.productinfo,
    params.amount,
    params.txnid,
    params.key,
  ].join('|')
}

export async function sha512Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-512', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function payURequestHash(params: PayUHashParams, salt: string): Promise<string> {
  return sha512Hex(buildPayUHashString(params, salt))
}

export async function payUResponseHash(
  params: PayUHashParams & { status: string },
  salt: string,
): Promise<string> {
  return sha512Hex(buildPayUReverseHashString(params, salt))
}

/** Allowed PayU `pg` values for merchant-hosted form post. */
export const PAYU_ALLOWED_PG = new Set([
  'UPI',
  'CC',
  'DC',
  'NB',
  'CASH',
  'EMI',
  'BNPL',
  'PAYPAL',
  'MC',
  'NEFTRTGS',
])

/**
 * Browser form-POST fallback (no `txn_s2s_flow`) lands on PayU hosted
 * `api.payu.in/public/#/...` — not merchant-hosted S2S. Keep disabled so we
 * surface EX* errors instead of silently dumping buyers onto PayU's page.
 */
export function payuSupportsFormPostFallback(_fields: Record<string, string>): boolean {
  return false
}

/**
 * PayU NB / card S2S often returns `result.acsTemplate` as Base64-encoded HTML.
 * @see https://docs.payu.in/docs/netbanking-integration-merchant-hosted-integration-cb
 */
export function normalizePayuAcsHtml(raw: string): string {
  const value = String(raw ?? '').trim()
  if (!value) return value
  if (/^\s*</.test(value) || /<!DOCTYPE|<html|<form/i.test(value)) {
    return value
  }
  try {
    const decoded = atob(value.replace(/\s+/g, ''))
    if (/^\s*</.test(decoded) || /<!DOCTYPE|<html|<form/i.test(decoded)) {
      return decoded
    }
  } catch {
    // not base64 — return as-is
  }
  return value
}

export function stripPayuS2sOnlyFields(fields: Record<string, string>): void {
  delete fields.txn_s2s_flow
  delete fields.s2s_client_ip
  delete fields.s2s_device_info
  delete fields.service_provider
  delete fields.threeDS2RequestData
}

const MODE_DEFAULTS: Record<
  string,
  { pg?: string; bankcode?: string; extraFields?: Record<string, string>; s2s?: boolean }
> = {
  all: { pg: 'UPI', bankcode: 'INTENT', s2s: true },
  cards: { pg: 'CC', bankcode: 'CC', s2s: true },
  netbanking: { pg: 'NB', bankcode: 'HDFB', s2s: true },
  wallets: { pg: 'CASH', bankcode: 'PAYTM', s2s: true },
  upi: { pg: 'UPI', bankcode: 'INTENT', s2s: true },
  upi_collect: { pg: 'UPI', bankcode: 'UPI', s2s: true },
  upi_intent: { pg: 'UPI', bankcode: 'INTENT', s2s: true },
  upi_gpay: { pg: 'UPI', bankcode: 'TEZ', extraFields: { upiAppName: 'gpay' }, s2s: true },
  upi_phonepe: {
    pg: 'UPI',
    bankcode: 'PHONEPE',
    extraFields: { upiAppName: 'phonepe' },
    s2s: true,
  },
  upi_paytm: { pg: 'UPI', bankcode: 'PAYTM', extraFields: { upiAppName: 'paytm' }, s2s: true },
  upi_qr: { pg: 'UPI', bankcode: 'INTENT', s2s: true },
  nb_hdfc: { pg: 'NB', bankcode: 'HDFB', s2s: true },
  nb_icici: { pg: 'NB', bankcode: 'ICIB', s2s: true },
  nb_sbi: { pg: 'NB', bankcode: 'SBIB', s2s: true },
  nb_axis: { pg: 'NB', bankcode: 'AXIB', s2s: true },
  nb_kotak: { pg: 'NB', bankcode: '162B', s2s: true },
  nb_yes: { pg: 'NB', bankcode: 'YESB', s2s: true },
  nb_pnb: { pg: 'NB', bankcode: 'PNBB', s2s: true },
  nb_bob: { pg: 'NB', bankcode: 'BBRB', s2s: true },
  wallet_paytm: { pg: 'CASH', bankcode: 'PAYTM', s2s: true },
  wallet_phonepe: { pg: 'CASH', bankcode: 'PHONEPE', s2s: true },
  wallet_amazon: { pg: 'CASH', bankcode: 'AMAZONPAY', s2s: true },
  wallet_freecharge: { pg: 'CASH', bankcode: 'FREC', s2s: true },
  wallet_mobikwik: { pg: 'CASH', bankcode: 'MOBIKWIK', s2s: true },
  emi: { pg: 'EMI', bankcode: 'EMI', s2s: true },
  bnpl: { pg: 'BNPL', bankcode: 'LAZYPAY', s2s: true },
  paypal: { pg: 'PAYPAL', bankcode: 'PAYPAL', s2s: true },
  pluxee: { pg: 'MC', bankcode: 'SODEXO', s2s: true },
  neft: { pg: 'NEFTRTGS', bankcode: 'EFTAXTPV', extraFields: { api_version: '6' }, s2s: true },
  qr: { pg: 'UPI', bankcode: 'INTENT', s2s: true },
}

/**
 * UPI + cards use server S2S (`txn_s2s_flow=4`).
 * Net banking / wallets / EMI use classic Merchant Hosted browser form-POST
 * (pg + bankcode, no `txn_s2s_flow`) — matching PayU dashboard "Merchant Hosted
 * Checkout" and docs. Sending S2S4 for NB on MHC-only merchants returns EX158.
 */
export function payuModeNeedsS2s(modeId?: string | null): boolean {
  const id = String(modeId ?? '').toLowerCase()
  if (
    id.startsWith('nb_') ||
    id === 'netbanking' ||
    id === 'nb_picker' ||
    id.startsWith('wallet_') ||
    id === 'wallets' ||
    id === 'wallet_picker' ||
    id === 'emi' ||
    id === 'bnpl' ||
    id === 'paypal' ||
    id === 'pluxee' ||
    id === 'neft'
  ) {
    return false
  }
  return true
}

export function normalizePayuIntentUri(intentURIData: string | null | undefined): string | null {
  const raw = String(intentURIData ?? '').trim()
  if (!raw) return null
  if (/^upi:\/\//i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  return `upi://pay?${raw.replace(/^\?/, '')}`
}

/** POST form-urlencoded to PayU `_payment` (curl / Postman Merchant Hosted). */
export async function payuSeamlessPaymentPost(
  actionUrl: string,
  fields: Record<string, string>,
): Promise<{ ok: boolean; status: number; text: string; json: Record<string, unknown> | null }> {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
    if (value != null) body.append(key, String(value))
  }
  const response = await fetch(actionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json, text/plain, */*',
    },
    body,
  })
  const text = await response.text()
  let json: Record<string, unknown> | null = null
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    // HTML error pages are common when keys/hash are wrong
  }
  return { ok: response.ok, status: response.status, text, json }
}

export function extractPayuIntentFromS2s(json: Record<string, unknown> | null): string | null {
  if (!json) return null
  const result = (json.result ?? json) as Record<string, unknown>
  const meta = (json.metaData ?? json.metadata ?? {}) as Record<string, unknown>
  const candidates = [
    result?.intentURIData,
    result?.intentUriData,
    result?.intent_uri,
    result?.deeplink,
    result?.deepLink,
    json.intentURIData,
    meta?.intentURIData,
  ]
  for (const value of candidates) {
    const uri = normalizePayuIntentUri(value != null ? String(value) : '')
    if (uri) return uri
  }
  return null
}

export type PayuS2sOutcome =
  | { kind: 'upi_intent'; intentUri: string; unmapped: string; payuId: string | null }
  | { kind: 'acs'; acsHtml: string; unmapped: string; payuId: string | null }
  | { kind: 'redirect'; url: string; unmapped: string; payuId: string | null }
  | { kind: 'success'; unmapped: string; payuId: string | null }
  | { kind: 'pending'; message: string; unmapped: string; payuId: string | null }
  | { kind: 'failure'; message: string; unmapped: string; payuId: string | null }

function unmappedFromS2s(json: Record<string, unknown> | null): string {
  if (!json) return ''
  const meta = (json.metaData ?? json.metadata ?? {}) as Record<string, unknown>
  const raw = meta.unmappedStatus ?? meta.unmappedstatus ?? json.unmappedStatus ?? json.unmappedstatus
  if (raw != null && String(raw).trim() !== '') return String(raw).toLowerCase()
  // Don't treat numeric/status codes like "0" / "1" as unmappedStatus
  return ''
}

function payuIdFromS2s(json: Record<string, unknown> | null): string | null {
  if (!json) return null
  const result = (json.result ?? {}) as Record<string, unknown>
  const id = result.mihpayid ?? result.payuId ?? result.payu_id ?? json.mihpayid ?? json.payuId
  return id != null && String(id).trim() ? String(id) : null
}

function payuErrorMessage(json: Record<string, unknown> | null, text: string): string {
  if (!json) return text.slice(0, 280) || 'PayU returned an empty response'
  const result = (json.result ?? {}) as Record<string, unknown>
  const meta = (json.metaData ?? json.metadata ?? {}) as Record<string, unknown>
  const statusCode = String(meta.statusCode ?? json.statusCode ?? json.error ?? '').trim()
  const candidates = [
    meta.message,
    json.message,
    result.error_Message,
    result.error_message,
    result.Error_Message,
    result.field9,
    result.message,
    result.error,
    json.error,
  ]
  let message = ''
  for (const value of candidates) {
    if (value != null && String(value).trim()) {
      message = String(value).trim()
      break
    }
  }
  if (!message && statusCode) message = statusCode
  if (!message) return 'Payment failed'

  // Map common PayU merchant-integration / 3DS codes to actionable copy
  const code = statusCode.toUpperCase() || message.toUpperCase()
  if (code === 'EX413' || message.includes('EX413')) {
    return 'Card authentication could not start. Try again, or use UPI / Scan QR. If this keeps happening, card payments may not be enabled on SHEPay yet.'
  }
  if (code === 'EX158' || message.includes('EX158')) {
    return 'PayU rejected S2S (EX158). Net banking should use Merchant Hosted form-post (no txn_s2s_flow). Try again, or pay with UPI / Scan QR.'
  }
  if (code.startsWith('EX') && (message === code || message.includes('Merchant Integration'))) {
    return `Payment could not start (${code}). Try UPI / Scan QR, or another method.`
  }
  if (statusCode && !message.includes(statusCode)) {
    return `${message} (${statusCode})`
  }
  return message
}

/** Classify S2S `_payment` JSON for UPI / cards / NB / wallets. */
export function classifyPayuS2sResponse(
  json: Record<string, unknown> | null,
  text: string,
): PayuS2sOutcome {
  const unmapped = unmappedFromS2s(json)
  const payuId = payuIdFromS2s(json)
  const intentUri = extractPayuIntentFromS2s(json)
  if (intentUri) {
    return { kind: 'upi_intent', intentUri, unmapped: unmapped || 'pending', payuId }
  }

  const result = (json?.result ?? json ?? {}) as Record<string, unknown>
  const acs =
    result.acsTemplate ??
    result.acs_template ??
    result.HTML ??
    result.html ??
    json?.acsTemplate
  if (acs && String(acs).trim()) {
    return {
      kind: 'acs',
      acsHtml: normalizePayuAcsHtml(String(acs)),
      unmapped: unmapped || 'pending',
      payuId,
    }
  }

  const redirect =
    result.post_uri ??
    result.postUri ??
    result.redirectUrl ??
    result.redirect_url ??
    result.url ??
    result.bank_url
  if (redirect && /^https?:\/\//i.test(String(redirect))) {
    const url = String(redirect)
    // PayU hosted checkout URL means S2S did not return a bank ACS — treat as failure.
    if (/api\.payu\.in\/public/i.test(url)) {
      return {
        kind: 'failure',
        message:
          'PayU returned its hosted checkout page instead of bank S2S. Enable Merchant Hosted net banking on the live merchant, or try UPI.',
        unmapped: unmapped || 'failure',
        payuId,
      }
    }
    return { kind: 'redirect', url, unmapped: unmapped || 'pending', payuId }
  }

  if (unmapped === 'success' || unmapped === 'captured' || unmapped === 'auth') {
    return { kind: 'success', unmapped, payuId }
  }
  if (unmapped === 'failure' || unmapped === 'failed' || unmapped === 'bounced') {
    return { kind: 'failure', message: payuErrorMessage(json, text), unmapped, payuId }
  }

  if (json) {
    // PayU merchant exceptions often live only in metaData.statusCode (EX*)
    const meta = (json.metaData ?? json.metadata ?? {}) as Record<string, unknown>
    const statusCode = String(meta.statusCode ?? json.statusCode ?? '').toUpperCase()
    const statusRaw = String(json.status ?? result.status ?? meta.txnStatus ?? '').toLowerCase()
    if (
      statusCode.startsWith('EX') ||
      statusRaw === '0' ||
      statusRaw === 'failure' ||
      statusRaw === 'failed' ||
      json.error
    ) {
      return {
        kind: 'failure',
        message: payuErrorMessage(json, text),
        unmapped: unmapped || 'failure',
        payuId,
      }
    }
    return {
      kind: 'pending',
      message: payuErrorMessage(json, text) || 'Awaiting customer action',
      unmapped: unmapped || 'pending',
      payuId,
    }
  }

  if (text.trim().startsWith('<') || /<html/i.test(text)) {
    return { kind: 'acs', acsHtml: text, unmapped: 'pending', payuId: null }
  }

  return {
    kind: 'failure',
    message: text.slice(0, 280) || 'PayU returned an empty response',
    unmapped: 'failure',
    payuId: null,
  }
}

/** Never echo PAN/CVV back to the browser. */
export function sanitizePayuFieldsForClient(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...fields }
  for (const key of ['ccnum', 'ccvv', 'ccexpmon', 'ccexpyr', 'ccname']) {
    delete out[key]
  }
  return out
}

export function payuInfoBaseUrl(creds: PayuCredentials): string {
  void creds
  return 'https://info.payu.in/merchant/postservice.php?form=2'
}

export async function payuCommandHash(
  key: string,
  command: string,
  var1: string,
  salt: string,
): Promise<string> {
  return sha512Hex(`${key}|${command}|${var1}|${salt}`)
}

/** PayU merchant postservice (getBinInfo, verify_payment, …). */
export async function payuMerchantCommand(
  creds: PayuCredentials,
  command: string,
  vars: { var1?: string; var2?: string; var3?: string; var4?: string; var5?: string },
): Promise<{ ok: boolean; status: number; text: string; json: Record<string, unknown> | null }> {
  const var1 = vars.var1 ?? ''
  const hash = await payuCommandHash(creds.key, command, var1, creds.salt)
  const body = new URLSearchParams({
    key: creds.key,
    command,
    var1,
    hash,
  })
  if (vars.var2 != null) body.set('var2', vars.var2)
  if (vars.var3 != null) body.set('var3', vars.var3)
  if (vars.var4 != null) body.set('var4', vars.var4)
  if (vars.var5 != null) body.set('var5', vars.var5)

  const response = await fetch(payuInfoBaseUrl(creds), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json, text/plain, */*',
    },
    body,
  })
  const text = await response.text()
  let json: Record<string, unknown> | null = null
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    // PayU sometimes returns PHP-array-like text
  }
  return { ok: response.ok, status: response.status, text, json }
}

export function applyPayuPaymentModeFields(
  fields: Record<string, string>,
  input: {
    pg?: string | null
    bankcode?: string | null
    modeId?: string | null
    extraFields?: Record<string, string> | null
  },
): Record<string, string> {
  const modeKey = String(input.modeId ?? 'all')
    .trim()
    .toLowerCase()
  const mode = MODE_DEFAULTS[modeKey] ?? MODE_DEFAULTS.all
  const pg = String(input.pg ?? mode.pg ?? '')
    .trim()
    .toUpperCase()
  const bankcode = String(input.bankcode ?? mode.bankcode ?? '').trim()

  if (pg && PAYU_ALLOWED_PG.has(pg)) {
    fields.pg = pg
  }
  if (bankcode) {
    fields.bankcode = bankcode
  }

  const extras = { ...(mode.extraFields ?? {}), ...(input.extraFields ?? {}) }
  for (const [key, value] of Object.entries(extras)) {
    if (value != null && String(value).trim() !== '') {
      fields[key] = String(value)
    }
  }

  return fields
}

export type PayuEnvMode = 'live' | 'test'

export type PayuCredentials = {
  mode: PayuEnvMode
  key: string
  salt: string
  baseUrl: string
  mid?: string
}

/** SHEPay checkout always uses live PayU (secure.payu.in). Test/sandbox is disabled. */
export function resolvePayuEnvMode(): PayuEnvMode {
  return 'live'
}

/**
 * Resolve live merchant key/salt/base.
 * Prefers PAYU_LIVE_*; falls back to PAYU_MERCHANT_KEY/SALT.
 * Never uses PAYU_TEST_* or test.payu.in.
 */
export function resolvePayuCredentials(): PayuCredentials | null {
  const key =
    Deno.env.get('PAYU_LIVE_MERCHANT_KEY')?.trim() ||
    Deno.env.get('PAYU_MERCHANT_KEY')?.trim() ||
    ''
  const salt =
    Deno.env.get('PAYU_LIVE_MERCHANT_SALT')?.trim() ||
    Deno.env.get('PAYU_MERCHANT_SALT')?.trim() ||
    ''
  if (!key || !salt) return null

  let baseUrl =
    Deno.env.get('PAYU_LIVE_BASE_URL')?.replace(/\/$/, '').trim() ||
    Deno.env.get('PAYU_BASE_URL')?.replace(/\/$/, '').trim() ||
    'https://secure.payu.in'
  // Guard against accidental test endpoint
  if (baseUrl.toLowerCase().includes('test.payu.in')) {
    baseUrl = 'https://secure.payu.in'
  }

  return {
    mode: 'live',
    key,
    salt,
    baseUrl,
    mid: Deno.env.get('PAYU_LIVE_MID')?.trim() || undefined,
  }
}

/** @deprecated use resolvePayuCredentials().baseUrl */
export function resolvePayuBaseUrl(): string {
  return resolvePayuCredentials()?.baseUrl ?? 'https://secure.payu.in'
}
