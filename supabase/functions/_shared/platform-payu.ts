/**
 * Platform PayU (default gateway when vendor has no own provider).
 * Env mode: PLATFORM_PAYU_ENV only (test | live) — independent of PAYU_ENV / SHEPay.
 * Keys/salts: PAYU_TEST_* or PAYU_LIVE_* / PAYU_MERCHANT_* from existing secrets.
 */

import { resolvePublicAppOrigin } from './app-url.ts'
import {
  payURequestHash,
  payUResponseHash,
  type PayuCredentials,
} from './payu.ts'

export type PlatformPayuEnvMode = 'test' | 'live'

function normalizePayuBaseUrl(isTest: boolean): string {
  if (isTest) return 'https://test.payu.in'
  const trimmed = Deno.env.get('PAYU_BASE_URL')?.replace(/\/$/, '').trim()
  if (trimmed && !trimmed.toLowerCase().includes('test.payu.in')) return trimmed
  return 'https://secure.payu.in'
}

/**
 * Platform PayU env — PLATFORM_PAYU_ENV only (never reads PAYU_ENV).
 * Default: test until you explicitly set live in Supabase secrets.
 */
export function resolvePlatformPayuEnvMode(): PlatformPayuEnvMode {
  const raw = (Deno.env.get('PLATFORM_PAYU_ENV') ?? 'test').trim().toLowerCase()
  if (raw === 'live' || raw === 'production' || raw === 'prod') return 'live'
  return 'test'
}

function credentialsForMode(mode: PlatformPayuEnvMode): PayuCredentials | null {
  const isTest = mode === 'test'

  const key = isTest
    ? Deno.env.get('PAYU_TEST_MERCHANT_KEY')?.trim() || ''
    : Deno.env.get('PAYU_LIVE_MERCHANT_KEY')?.trim() ||
      Deno.env.get('PAYU_MERCHANT_KEY')?.trim() ||
      ''

  const salt = isTest
    ? Deno.env.get('PAYU_TEST_MERCHANT_SALT')?.trim() || ''
    : Deno.env.get('PAYU_LIVE_MERCHANT_SALT')?.trim() ||
      Deno.env.get('PAYU_MERCHANT_SALT')?.trim() ||
      ''

  if (!key || !salt) return null

  const baseUrl = normalizePayuBaseUrl(isTest)
  const mid = isTest
    ? Deno.env.get('PAYU_TEST_MID')?.trim() || undefined
    : Deno.env.get('PAYU_LIVE_MID')?.trim() || undefined

  return { mode, key, salt, baseUrl, mid }
}

/** Active credentials for initiate — driven by PLATFORM_PAYU_ENV. */
export function resolvePlatformPayuCredentials(): PayuCredentials | null {
  return credentialsForMode(resolvePlatformPayuEnvMode())
}

/**
 * Credential pairs for callback/webhook hash verification.
 * Always includes test + live when configured (PayU posts back the merchant key used at checkout).
 */
export function collectPlatformPayuCredentialCandidates(): PayuCredentials[] {
  const out: PayuCredentials[] = []
  const active = resolvePlatformPayuEnvMode()
  const activeCred = credentialsForMode(active)
  if (activeCred) out.push(activeCred)

  const alternate: PlatformPayuEnvMode = active === 'test' ? 'live' : 'test'
  const altCred = credentialsForMode(alternate)
  if (altCred && !out.some((row) => row.key === altCred.key && row.salt === altCred.salt)) {
    out.push(altCred)
  }
  return out
}

export async function matchPlatformPayuCredentials(
  form: Record<string, string>,
  candidates: PayuCredentials[] = collectPlatformPayuCredentialCandidates(),
): Promise<PayuCredentials | null> {
  if (!candidates.length) return null

  const formKey = String(form.key ?? '').trim()
  const ordered = formKey
    ? [
        ...candidates.filter((cred) => cred.key === formKey),
        ...candidates.filter((cred) => cred.key !== formKey),
      ]
    : candidates

  for (const cred of ordered) {
    if (await verifyPlatformPayuResponseHash(cred, form)) return cred
  }
  return null
}

export function formatPlatformPayuAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2)
}

export function buildPlatformPayuTxnId(orderId: string): string {
  const short = orderId.replace(/-/g, '').slice(0, 12)
  return `TXN_${short}_${Date.now().toString(36)}`
}

export type PlatformPayuFormFields = {
  key: string
  txnid: string
  amount: string
  productinfo: string
  firstname: string
  email: string
  phone?: string
  udf1?: string
  udf2?: string
  udf3?: string
  udf4?: string
  udf5?: string
  surl: string
  furl: string
  hash: string
  service_provider?: string
}

export async function buildPlatformPayuPaymentFields(input: {
  creds: PayuCredentials
  txnid: string
  amount: string
  productinfo: string
  firstname: string
  email: string
  phone: string
  udf1: string
  udf2: string
  udf3: string
  udf4: string
  udf5: string
  supabaseUrl: string
  /** When true, callback redirects to /payu-embed-return for iframe 3DS. */
  embed?: boolean
}): Promise<PlatformPayuFormFields> {
  const { creds, txnid, amount, productinfo, firstname, email, phone } = input
  const hash = await payURequestHash(
    {
      key: creds.key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1: input.udf1,
      udf2: input.udf2,
      udf3: input.udf3,
      udf4: input.udf4,
      udf5: input.udf5,
    },
    creds.salt,
  )

  const callbackBase = `${input.supabaseUrl.replace(/\/$/, '')}/functions/v1/platform-payu-callback`
  const embedQuery = input.embed ? '&embed=1' : ''

  return {
    key: creds.key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    phone,
    udf1: input.udf1,
    udf2: input.udf2,
    udf3: input.udf3,
    udf4: input.udf4,
    udf5: input.udf5,
    hash,
    surl: `${callbackBase}?status=success${embedQuery}`,
    furl: `${callbackBase}?status=failure${embedQuery}`,
    service_provider: 'payu_paisa',
  }
}

export async function verifyPlatformPayuResponseHash(
  creds: PayuCredentials,
  form: Record<string, string>,
): Promise<boolean> {
  const hash = String(form.hash ?? '')
  if (!hash) return false

  const expected = await payUResponseHash(
    {
      key: creds.key,
      txnid: String(form.txnid ?? ''),
      amount: String(form.amount ?? ''),
      productinfo: String(form.productinfo ?? ''),
      firstname: String(form.firstname ?? ''),
      email: String(form.email ?? ''),
      udf1: String(form.udf1 ?? ''),
      udf2: String(form.udf2 ?? ''),
      udf3: String(form.udf3 ?? ''),
      udf4: String(form.udf4 ?? ''),
      udf5: String(form.udf5 ?? ''),
      status: String(form.status ?? ''),
    },
    creds.salt,
  )

  return expected.toLowerCase() === hash.toLowerCase()
}

export function mapPayuStatusToPaymentStatus(
  payuStatus: string,
): 'completed' | 'failed' | 'processing' | 'cancelled' {
  const s = payuStatus.trim().toLowerCase()
  if (s === 'success') return 'completed'
  if (s === 'failure' || s === 'failed') return 'failed'
  if (s === 'cancelled' || s === 'cancel') return 'cancelled'
  return 'processing'
}

export function mapPayuStatusToLogEvent(payuStatus: string): 'success' | 'failure' | 'webhook' {
  const s = payuStatus.trim().toLowerCase()
  if (s === 'success') return 'success'
  if (s === 'failure' || s === 'failed') return 'failure'
  return 'webhook'
}

export function mapPayuStatusToLogStatus(
  payuStatus: string,
): 'completed' | 'failed' | 'pending' | 'processing' {
  const s = payuStatus.trim().toLowerCase()
  if (s === 'success') return 'completed'
  if (s === 'failure' || s === 'failed') return 'failed'
  if (s === 'pending') return 'pending'
  return 'processing'
}

export function platformPayuAppRedirect(
  status: 'success' | 'failure',
  txnid: string,
  reason?: string,
  options?: { embed?: boolean },
): string {
  const appBase = resolvePublicAppOrigin()
  if (options?.embed) {
    const dest = new URL('/payu-embed-return', appBase)
    dest.searchParams.set('status', status === 'success' ? 'success' : 'failure')
    if (txnid) dest.searchParams.set('txn', txnid)
    return dest.toString()
  }
  const path = status === 'success' ? '/payment/success' : '/payment/failure'
  const dest = new URL(path, appBase)
  if (txnid) dest.searchParams.set('txn', txnid)
  if (reason && status === 'failure') dest.searchParams.set('reason', reason.slice(0, 240))
  return dest.toString()
}

export async function parsePayuFormBody(request: Request): Promise<Record<string, string>> {
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
