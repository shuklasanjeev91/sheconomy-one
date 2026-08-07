/**
 * PayU Merchant Hosted / Seamless modes (curl-style `_payment` with pg + bankcode).
 * @see https://docs.payu.in/docs/custom-checkout-merchant-hosted
 * @see https://docs.payu.in/docs/collect-payments-with-net-banking-seamless
 * @see https://docs.payu.in/docs/upi-intent-server-to-server
 */

export type PayuPaymentModeId =
  | 'all'
  | 'cards'
  | 'netbanking'
  | 'wallets'
  | 'upi'
  | 'upi_collect'
  | 'upi_intent'
  | 'upi_gpay'
  | 'upi_phonepe'
  | 'upi_paytm'
  | 'upi_qr'
  | 'emi'
  | 'bnpl'
  | 'paypal'
  | 'pluxee'
  | 'neft'
  | 'qr'
  | 'nb_picker'
  | 'wallet_picker'
  | 'nb_hdfc'
  | 'nb_icici'
  | 'nb_sbi'
  | 'nb_axis'
  | 'nb_kotak'
  | 'nb_yes'
  | 'nb_pnb'
  | 'nb_bob'
  | 'wallet_paytm'
  | 'wallet_phonepe'
  | 'wallet_amazon'
  | 'wallet_freecharge'
  | 'wallet_mobikwik'

export type PayuPaymentMode = {
  id: PayuPaymentModeId
  label: string
  shortLabel: string
  /** PayU `pg` — omit only for legacy “all” (avoid — shows PayU picker) */
  pg?: string
  /** PayU `bankcode` for seamless curl/form post */
  bankcode?: string
  /** Extra `_payment` fields */
  extraFields?: Record<string, string>
  /** Collect VPA before charge */
  needsVpa?: boolean
  /**
   * UPI Intent / QR must use server-to-server `_payment` (`txn_s2s_flow=4`)
   * — not a browser iframe of PayU checkout.
   */
  seamlessS2s?: boolean
}

export type PayuMethodGroupId =
  | 'all'
  | 'upi'
  | 'cards'
  | 'netbanking'
  | 'wallets'
  | 'emi'
  | 'bnpl'
  | 'paypal'
  | 'pluxee'
  | 'neft'

export type PayuMethodGroup = {
  id: PayuMethodGroupId
  label: string
  shortLabel: string
  options: PayuPaymentMode[]
}

export const PAYU_UPI_OPTIONS: PayuPaymentMode[] = [
  {
    id: 'upi_collect',
    label: 'UPI ID / VPA',
    shortLabel: 'UPI ID',
    pg: 'UPI',
    bankcode: 'UPI',
    needsVpa: true,
  },
  {
    id: 'upi_gpay',
    label: 'Google Pay',
    shortLabel: 'GPay',
    pg: 'UPI',
    bankcode: 'TEZ',
    extraFields: { upiAppName: 'gpay' },
    seamlessS2s: true,
  },
  {
    id: 'upi_phonepe',
    label: 'PhonePe',
    shortLabel: 'PhonePe',
    pg: 'UPI',
    bankcode: 'PHONEPE',
    extraFields: { upiAppName: 'phonepe' },
    seamlessS2s: true,
  },
  {
    id: 'upi_paytm',
    label: 'Paytm',
    shortLabel: 'Paytm',
    pg: 'UPI',
    bankcode: 'PAYTM',
    extraFields: { upiAppName: 'paytm' },
    seamlessS2s: true,
  },
  {
    id: 'upi_intent',
    label: 'Other UPI apps',
    shortLabel: 'Other apps',
    pg: 'UPI',
    bankcode: 'INTENT',
    seamlessS2s: true,
  },
  {
    id: 'upi_qr',
    label: 'Scan QR code',
    shortLabel: 'QR',
    pg: 'UPI',
    bankcode: 'INTENT',
    seamlessS2s: true,
  },
]

export const PAYU_CARD_OPTIONS: PayuPaymentMode[] = [
  {
    id: 'cards',
    label: 'Credit / Debit card',
    shortLabel: 'Cards',
    pg: 'CC',
    bankcode: 'CC',
    seamlessS2s: true,
  },
]

/** Net banking — Merchant Hosted live: pg=NB + bankcode */
export const PAYU_NB_OPTIONS: PayuPaymentMode[] = [
  { id: 'nb_hdfc', label: 'HDFC Bank', shortLabel: 'HDFC', pg: 'NB', bankcode: 'HDFB', seamlessS2s: true },
  { id: 'nb_icici', label: 'ICICI Bank', shortLabel: 'ICICI', pg: 'NB', bankcode: 'ICIB', seamlessS2s: true },
  { id: 'nb_sbi', label: 'State Bank of India', shortLabel: 'SBI', pg: 'NB', bankcode: 'SBIB', seamlessS2s: true },
  { id: 'nb_axis', label: 'Axis Bank', shortLabel: 'Axis', pg: 'NB', bankcode: 'AXIB', seamlessS2s: true },
  { id: 'nb_kotak', label: 'Kotak Mahindra', shortLabel: 'Kotak', pg: 'NB', bankcode: '162B', seamlessS2s: true },
  { id: 'nb_yes', label: 'Yes Bank', shortLabel: 'Yes', pg: 'NB', bankcode: 'YESB', seamlessS2s: true },
  { id: 'nb_pnb', label: 'Punjab National Bank', shortLabel: 'PNB', pg: 'NB', bankcode: 'PNBB', seamlessS2s: true },
  { id: 'nb_bob', label: 'Bank of Baroda', shortLabel: 'BoB', pg: 'NB', bankcode: 'BBRB', seamlessS2s: true },
]

export const PAYU_WALLET_OPTIONS: PayuPaymentMode[] = [
  { id: 'wallet_paytm', label: 'Paytm', shortLabel: 'Paytm', pg: 'CASH', bankcode: 'PAYTM', seamlessS2s: true },
  { id: 'wallet_phonepe', label: 'PhonePe', shortLabel: 'PhonePe', pg: 'CASH', bankcode: 'PHONEPE', seamlessS2s: true },
  { id: 'wallet_amazon', label: 'Amazon Pay', shortLabel: 'Amazon', pg: 'CASH', bankcode: 'AMAZONPAY', seamlessS2s: true },
  {
    id: 'wallet_freecharge',
    label: 'Freecharge',
    shortLabel: 'Freecharge',
    pg: 'CASH',
    bankcode: 'FREC',
    seamlessS2s: true,
  },
  {
    id: 'wallet_mobikwik',
    label: 'MobiKwik',
    shortLabel: 'MobiKwik',
    pg: 'CASH',
    bankcode: 'MOBIKWIK',
    seamlessS2s: true,
  },
]

export const PAYU_METHOD_GROUPS: PayuMethodGroup[] = [
  {
    id: 'all',
    label: 'All methods',
    shortLabel: 'All',
    options: [
      {
        id: 'upi_intent',
        label: 'UPI apps',
        shortLabel: 'UPI',
        pg: 'UPI',
        bankcode: 'INTENT',
        seamlessS2s: true,
      },
    ],
  },
  {
    id: 'upi',
    label: 'UPI',
    shortLabel: 'UPI',
    options: PAYU_UPI_OPTIONS,
  },
  {
    id: 'cards',
    label: 'Cards',
    shortLabel: 'Cards',
    options: PAYU_CARD_OPTIONS,
  },
  {
    id: 'netbanking',
    label: 'Net Banking',
    shortLabel: 'NB',
    options: PAYU_NB_OPTIONS,
  },
  {
    id: 'wallets',
    label: 'Wallets',
    shortLabel: 'Wallets',
    options: PAYU_WALLET_OPTIONS,
  },
  {
    id: 'emi',
    label: 'EMI',
    shortLabel: 'EMI',
    options: [{ id: 'emi', label: 'EMI', shortLabel: 'EMI', pg: 'EMI' }],
  },
  {
    id: 'bnpl',
    label: 'Buy Now Pay Later',
    shortLabel: 'BNPL',
    options: [{ id: 'bnpl', label: 'Buy Now Pay Later', shortLabel: 'BNPL', pg: 'BNPL' }],
  },
  {
    id: 'paypal',
    label: 'PayPal',
    shortLabel: 'PayPal',
    options: [{ id: 'paypal', label: 'PayPal', shortLabel: 'PayPal', pg: 'PAYPAL' }],
  },
  {
    id: 'pluxee',
    label: 'Pluxee (Sodexo)',
    shortLabel: 'Pluxee',
    options: [
      { id: 'pluxee', label: 'Pluxee (Sodexo)', shortLabel: 'Pluxee', pg: 'MC', bankcode: 'SODEXO' },
    ],
  },
  {
    id: 'neft',
    label: 'NEFT / RTGS',
    shortLabel: 'NEFT',
    options: [
      {
        id: 'neft',
        label: 'NEFT / RTGS',
        shortLabel: 'NEFT',
        pg: 'NEFTRTGS',
        bankcode: 'EFTAXTPV',
        extraFields: { api_version: '6' },
      },
    ],
  },
]

export const PAYU_CHECKOUT_MODES: PayuPaymentMode[] = [
  {
    id: 'all',
    label: 'All methods',
    shortLabel: 'All',
    pg: 'UPI',
    bankcode: 'INTENT',
    seamlessS2s: true,
  },
  { id: 'upi', label: 'UPI', shortLabel: 'UPI', pg: 'UPI', bankcode: 'INTENT', seamlessS2s: true },
  ...PAYU_UPI_OPTIONS,
  ...PAYU_CARD_OPTIONS,
  { id: 'netbanking', label: 'Net Banking', shortLabel: 'NB', pg: 'NB', bankcode: 'HDFB', seamlessS2s: true },
  ...PAYU_NB_OPTIONS,
  { id: 'wallets', label: 'Wallets', shortLabel: 'Wallets', pg: 'CASH', bankcode: 'PAYTM', seamlessS2s: true },
  ...PAYU_WALLET_OPTIONS,
  { id: 'emi', label: 'EMI', shortLabel: 'EMI', pg: 'EMI', bankcode: 'EMI', seamlessS2s: true },
  { id: 'bnpl', label: 'Buy Now Pay Later', shortLabel: 'BNPL', pg: 'BNPL', bankcode: 'LAZYPAY', seamlessS2s: true },
  { id: 'paypal', label: 'PayPal', shortLabel: 'PayPal', pg: 'PAYPAL', bankcode: 'PAYPAL', seamlessS2s: true },
  {
    id: 'pluxee',
    label: 'Pluxee (Sodexo)',
    shortLabel: 'Pluxee',
    pg: 'MC',
    bankcode: 'SODEXO',
    seamlessS2s: true,
  },
  {
    id: 'neft',
    label: 'NEFT / RTGS',
    shortLabel: 'NEFT',
    pg: 'NEFTRTGS',
    bankcode: 'EFTAXTPV',
    extraFields: { api_version: '6' },
    seamlessS2s: true,
  },
  {
    id: 'qr',
    label: 'QR Code',
    shortLabel: 'QR',
    pg: 'UPI',
    bankcode: 'INTENT',
    seamlessS2s: true,
  },
]

const MODE_BY_ID = new Map(PAYU_CHECKOUT_MODES.map((mode) => [mode.id, mode]))
const GROUP_BY_ID = new Map(PAYU_METHOD_GROUPS.map((group) => [group.id, group]))

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

export function resolvePayuPaymentMode(id: string | null | undefined): PayuPaymentMode {
  if (!id) return PAYU_CHECKOUT_MODES[0]
  return MODE_BY_ID.get(id as PayuPaymentModeId) ?? PAYU_CHECKOUT_MODES[0]
}

export function resolvePayuMethodGroup(id: string | null | undefined): PayuMethodGroup {
  if (!id) return PAYU_METHOD_GROUPS[0]
  return GROUP_BY_ID.get(id as PayuMethodGroupId) ?? PAYU_METHOD_GROUPS[0]
}

export function payuGroupIdForMode(modeId: PayuPaymentModeId): PayuMethodGroupId {
  if (modeId === 'all') return 'all'
  if (modeId.startsWith('upi') || modeId === 'qr') return 'upi'
  if (modeId.startsWith('nb_') || modeId === 'netbanking' || modeId === 'nb_picker') {
    return 'netbanking'
  }
  if (modeId.startsWith('wallet_') || modeId === 'wallets' || modeId === 'wallet_picker') {
    return 'wallets'
  }
  if (modeId === 'cards') return 'cards'
  if (modeId === 'emi') return 'emi'
  if (modeId === 'bnpl') return 'bnpl'
  if (modeId === 'paypal') return 'paypal'
  if (modeId === 'pluxee') return 'pluxee'
  if (modeId === 'neft') return 'neft'
  return 'all'
}

export function payuModeNeedsS2s(modeId: string | null | undefined): boolean {
  const id = String(modeId ?? '').toLowerCase()
  // NB / wallets: classic Merchant Hosted form-POST (no txn_s2s_flow).
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

/** Build a full UPI deeplink from PayU `intentURIData` (query string or full URI). */
export function normalizePayuIntentUri(intentURIData: string | null | undefined): string | null {
  const raw = String(intentURIData ?? '').trim()
  if (!raw) return null
  if (/^upi:\/\//i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  return `upi://pay?${raw.replace(/^\?/, '')}`
}

export type PayuPaymentFieldsInput = {
  pg?: string | null
  bankcode?: string | null
  modeId?: string | null
  extraFields?: Record<string, string> | null
}

export function applyPayuPaymentModeFields(
  fields: Record<string, string>,
  input: PayuPaymentFieldsInput,
): Record<string, string> {
  const mode = resolvePayuPaymentMode(input.modeId)
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
