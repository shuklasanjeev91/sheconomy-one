/**
 * PayU Merchant Hosted Checkout payment modes.
 * @see https://docs.payu.in/docs/custom-checkout-merchant-hosted
 *
 * We preselect `pg` / `bankcode` when the buyer picks a method. Card PAN/CVV are
 * never collected in-app (PayU hosts those fields) to stay outside PCI SAQ A-EP.
 */

export type PayuPaymentModeId =
  | 'all'
  | 'cards'
  | 'netbanking'
  | 'wallets'
  | 'upi'
  | 'upi_intent'
  | 'upi_qr'
  | 'emi'
  | 'bnpl'
  | 'paypal'
  | 'pluxee'
  | 'neft'
  | 'qr'

export type PayuPaymentMode = {
  id: PayuPaymentModeId
  label: string
  shortLabel: string
  /** PayU `pg` — omit for full method picker on PayU */
  pg?: string
  /** PayU `bankcode` when the mode needs a fixed code */
  bankcode?: string
  /** Extra `_payment` fields (e.g. api_version for NEFT) */
  extraFields?: Record<string, string>
}

/** Buyer-facing chips shown at checkout for SHEPay. */
export const PAYU_CHECKOUT_MODES: PayuPaymentMode[] = [
  {
    id: 'all',
    label: 'All methods',
    shortLabel: 'All',
  },
  {
    id: 'upi',
    label: 'UPI',
    shortLabel: 'UPI',
    pg: 'UPI',
  },
  {
    id: 'cards',
    label: 'Cards',
    shortLabel: 'Cards',
    pg: 'CC',
    bankcode: 'CC',
  },
  {
    id: 'netbanking',
    label: 'Net Banking',
    shortLabel: 'NB',
    pg: 'NB',
  },
  {
    id: 'wallets',
    label: 'Wallets',
    shortLabel: 'Wallets',
    pg: 'CASH',
  },
  {
    id: 'emi',
    label: 'EMI',
    shortLabel: 'EMI',
    pg: 'EMI',
  },
  {
    id: 'bnpl',
    label: 'Buy Now Pay Later',
    shortLabel: 'BNPL',
    pg: 'BNPL',
  },
  {
    id: 'paypal',
    label: 'PayPal',
    shortLabel: 'PayPal',
    pg: 'PAYPAL',
  },
  {
    id: 'pluxee',
    label: 'Pluxee (Sodexo)',
    shortLabel: 'Pluxee',
    pg: 'MC',
    bankcode: 'SODEXO',
  },
  {
    id: 'neft',
    label: 'NEFT / RTGS',
    shortLabel: 'NEFT',
    pg: 'NEFTRTGS',
    bankcode: 'EFTAXTPV',
    extraFields: { api_version: '6' },
  },
  {
    id: 'qr',
    label: 'QR Code',
    shortLabel: 'QR',
    pg: 'UPI',
    bankcode: 'UPIDBQR',
  },
  {
    id: 'upi_intent',
    label: 'UPI Intent',
    shortLabel: 'Intent',
    pg: 'UPI',
    bankcode: 'INTENT',
  },
]

const MODE_BY_ID = new Map(PAYU_CHECKOUT_MODES.map((mode) => [mode.id, mode]))

/** Allowed PayU `pg` values for merchant-hosted form post (no card fields). */
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

export type PayuPaymentFieldsInput = {
  pg?: string | null
  bankcode?: string | null
  modeId?: string | null
  /** Optional extras from client (account no / IFSC for NB/NEFT when collected) */
  extraFields?: Record<string, string> | null
}

/** Merge preferred mode into PayU `_payment` fields. */
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
