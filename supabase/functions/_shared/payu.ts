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

/** Allowed PayU `pg` values for merchant-hosted form post (no card fields in-app). */
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

const MODE_DEFAULTS: Record<
  string,
  { pg?: string; bankcode?: string; extraFields?: Record<string, string> }
> = {
  all: {},
  cards: { pg: 'CC', bankcode: 'CC' },
  netbanking: { pg: 'NB' },
  wallets: { pg: 'CASH' },
  upi: { pg: 'UPI' },
  upi_intent: { pg: 'UPI', bankcode: 'INTENT' },
  upi_qr: { pg: 'UPI', bankcode: 'UPIDBQR' },
  emi: { pg: 'EMI' },
  bnpl: { pg: 'BNPL' },
  paypal: { pg: 'PAYPAL' },
  pluxee: { pg: 'MC', bankcode: 'SODEXO' },
  neft: { pg: 'NEFTRTGS', bankcode: 'EFTAXTPV', extraFields: { api_version: '6' } },
  qr: { pg: 'UPI', bankcode: 'UPIDBQR' },
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

export function resolvePayuEnvMode(): PayuEnvMode {
  const explicit = Deno.env.get('PAYU_ENV')?.trim().toLowerCase()
  if (explicit === 'test' || explicit === 'sandbox' || explicit === 'uat') return 'test'
  if (explicit === 'live' || explicit === 'prod' || explicit === 'production') return 'live'
  // Infer from base URL when set
  const base = Deno.env.get('PAYU_BASE_URL')?.toLowerCase() ?? ''
  if (base.includes('test.payu.in')) return 'test'
  return 'live'
}

/**
 * Resolve merchant key/salt/base for the active PayU environment.
 * Prefers PAYU_LIVE_* / PAYU_TEST_* pairs; falls back to PAYU_MERCHANT_KEY/SALT.
 */
export function resolvePayuCredentials(): PayuCredentials | null {
  const mode = resolvePayuEnvMode()
  if (mode === 'test') {
    const key =
      Deno.env.get('PAYU_TEST_MERCHANT_KEY')?.trim() ||
      Deno.env.get('PAYU_MERCHANT_KEY')?.trim() ||
      ''
    const salt =
      Deno.env.get('PAYU_TEST_MERCHANT_SALT')?.trim() ||
      Deno.env.get('PAYU_MERCHANT_SALT')?.trim() ||
      ''
    if (!key || !salt) return null
    const baseUrl =
      Deno.env.get('PAYU_TEST_BASE_URL')?.replace(/\/$/, '').trim() || 'https://test.payu.in'
    return {
      mode,
      key,
      salt,
      baseUrl,
      mid: Deno.env.get('PAYU_TEST_MID')?.trim() || undefined,
    }
  }

  const key =
    Deno.env.get('PAYU_LIVE_MERCHANT_KEY')?.trim() ||
    Deno.env.get('PAYU_MERCHANT_KEY')?.trim() ||
    ''
  const salt =
    Deno.env.get('PAYU_LIVE_MERCHANT_SALT')?.trim() ||
    Deno.env.get('PAYU_MERCHANT_SALT')?.trim() ||
    ''
  if (!key || !salt) return null
  const baseUrl =
    Deno.env.get('PAYU_LIVE_BASE_URL')?.replace(/\/$/, '').trim() ||
    Deno.env.get('PAYU_BASE_URL')?.replace(/\/$/, '').trim() ||
    'https://secure.payu.in'
  return {
    mode,
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
