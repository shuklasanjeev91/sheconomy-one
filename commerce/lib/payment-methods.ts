import type { BuyerPaymentMethod } from '~/commerce/lib/buyer-account'

export type PaymentMethodKind = 'card' | 'upi'
export type CardFundingType = 'credit' | 'debit'

export type PaymentMethodMetadata = {
  method_type?: PaymentMethodKind
  card_type?: CardFundingType
  cardholder_name?: string
  upi_id?: string
}

export type ParsedPaymentMethod = BuyerPaymentMethod & {
  kind: PaymentMethodKind
  cardType?: CardFundingType
  cardholderName?: string
  upiId?: string
}

const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{0,63}$/

export function parsePaymentMethod(row: BuyerPaymentMethod): ParsedPaymentMethod {
  const meta = readMetadata(row.metadata)
  const rowRecord = row as BuyerPaymentMethod & {
    method_type?: PaymentMethodKind | null
    card_type?: CardFundingType | null
    upi_id?: string | null
    cardholder_name?: string | null
  }

  const upiId = rowRecord.upi_id ?? meta.upi_id ?? null
  const kind: PaymentMethodKind =
    rowRecord.method_type ?? meta.method_type ?? (upiId ? 'upi' : 'card')

  return {
    ...row,
    kind,
    cardType: rowRecord.card_type ?? meta.card_type,
    cardholderName: rowRecord.cardholder_name ?? meta.cardholder_name,
    upiId,
  }
}

function readMetadata(value: BuyerPaymentMethod['metadata']): PaymentMethodMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as PaymentMethodMetadata
}

export function detectCardBrand(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.startsWith('4')) return 'Visa'
  if (/^5[1-5]/.test(digits)) return 'Mastercard'
  if (digits.startsWith('6')) return 'RuPay'
  if (/^3[47]/.test(digits)) return 'Amex'
  if (digits.startsWith('50') || digits.startsWith('60') || digits.startsWith('65')) {
    return 'RuPay'
  }
  return 'Card'
}

export function extractLastFour(cardNumber: string): string {
  return cardNumber.replace(/\D/g, '').slice(-4)
}

export function validateCardInput(input: {
  cardNumber: string
  cardholderName: string
  expMonth: string
  expYear: string
}): string | null {
  const digits = input.cardNumber.replace(/\D/g, '')
  if (digits.length < 13 || digits.length > 19) {
    return 'Enter a valid card number.'
  }

  if (!input.cardholderName.trim()) {
    return 'Enter the name on the card.'
  }

  const month = Number.parseInt(input.expMonth, 10)
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return 'Enter a valid expiry month (01–12).'
  }

  const year = normalizeExpYear(input.expYear)
  if (year === null) {
    return 'Enter a valid expiry year.'
  }

  const now = new Date()
  const expiry = new Date(year, month, 0, 23, 59, 59)
  if (expiry < now) {
    return 'This card has expired.'
  }

  return null
}

export function validateUpiId(upiId: string): string | null {
  const trimmed = upiId.trim().toLowerCase()
  if (!trimmed) {
    return 'Enter your UPI ID.'
  }
  if (!UPI_ID_PATTERN.test(trimmed)) {
    return 'Enter a valid UPI ID (e.g. name@bank).'
  }
  return null
}

export function normalizeUpiId(upiId: string): string {
  return upiId.trim().toLowerCase()
}

export function maskUpiId(upiId: string): string {
  const [handle, bank] = upiId.split('@')
  if (!bank) return upiId
  if (handle.length <= 2) return `${handle[0] ?? ''}••@${bank}`
  return `${handle.slice(0, 2)}••••@${bank}`
}

export function formatCardExpiry(expMonth: number | null, expYear: number | null): string {
  if (!expMonth || !expYear) return ''
  const month = String(expMonth).padStart(2, '0')
  const year = String(expYear).slice(-2)
  return `${month}/${year}`
}

export function paymentMethodTitle(method: ParsedPaymentMethod): string {
  if (method.kind === 'upi') {
    return method.label?.trim() || 'UPI'
  }
  const brand = method.card_brand ?? 'Card'
  const funding = method.cardType === 'debit' ? 'Debit' : method.cardType === 'credit' ? 'Credit' : ''
  return method.label?.trim() || [brand, funding, 'card'].filter(Boolean).join(' ')
}

export function paymentMethodSubtitle(method: ParsedPaymentMethod): string {
  if (method.kind === 'upi' && method.upiId) {
    return maskUpiId(method.upiId)
  }
  const lastFour = method.last_four ? `•••• ${method.last_four}` : ''
  const expiry = formatCardExpiry(method.exp_month, method.exp_year)
  return [lastFour, expiry ? `Exp ${expiry}` : ''].filter(Boolean).join(' · ')
}

export function normalizeExpYear(value: string): number | null {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 2) {
    return 2000 + Number.parseInt(digits, 10)
  }
  if (digits.length === 4) {
    return Number.parseInt(digits, 10)
  }
  return null
}

export function parseExpMonth(value: string): number | null {
  const month = Number.parseInt(value.replace(/\D/g, ''), 10)
  if (!Number.isFinite(month) || month < 1 || month > 12) return null
  return month
}
