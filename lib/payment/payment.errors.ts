/**
 * Centralised vendor payment gateway error handling.
 */

export const PAYMENT_ERROR_CODES = {
  NOT_AUTHENTICATED: 'payment/not-authenticated',
  NOT_FOUND: 'payment/not-found',
  PERMISSION_DENIED: 'payment/permission-denied',
  INVALID_INPUT: 'payment/invalid-input',
  DUPLICATE: 'payment/duplicate',
  PROVIDER_UNSUPPORTED: 'payment/provider-unsupported',
  CREDENTIALS_INVALID: 'payment/credentials-invalid',
  NETWORK: 'payment/network',
  UNKNOWN: 'payment/unknown',
} as const

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[keyof typeof PAYMENT_ERROR_CODES]

export const PAYMENT_ERROR_MESSAGES: Record<PaymentErrorCode, string> = {
  [PAYMENT_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage payment settings.',
  [PAYMENT_ERROR_CODES.NOT_FOUND]: 'We couldn’t find that payment record. It may have been removed.',
  [PAYMENT_ERROR_CODES.PERMISSION_DENIED]:
    'You don’t have permission to change payment settings for this shop. Only the owner or an admin can do that.',
  [PAYMENT_ERROR_CODES.INVALID_INPUT]:
    'Some payment details look invalid. Please review the highlighted fields.',
  [PAYMENT_ERROR_CODES.DUPLICATE]: 'This payment provider is already connected for this shop.',
  [PAYMENT_ERROR_CODES.PROVIDER_UNSUPPORTED]:
    'This payment provider isn’t supported by the database yet. Choose another provider or contact support.',
  [PAYMENT_ERROR_CODES.CREDENTIALS_INVALID]:
    'Payment credentials are incomplete or invalid. Check the required fields and try again.',
  [PAYMENT_ERROR_CODES.NETWORK]: 'Network issue — check your connection and try again.',
  [PAYMENT_ERROR_CODES.UNKNOWN]:
    'Something went wrong with payments. Please try again shortly.',
}

export class PaymentError extends Error {
  readonly code: PaymentErrorCode

  constructor(code: PaymentErrorCode, message?: string) {
    super(message ?? PAYMENT_ERROR_MESSAGES[code])
    this.name = 'PaymentError'
    this.code = code
  }
}

type SupabaseLikeError = {
  code?: string | null
  message?: string | null
}

function isSupabaseLikeError(value: unknown): value is SupabaseLikeError {
  return typeof value === 'object' && value !== null && ('message' in value || 'code' in value)
}

export function classifyPaymentError(error: unknown): PaymentErrorCode {
  if (error instanceof PaymentError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '23505') return PAYMENT_ERROR_CODES.DUPLICATE
    if (code === '42501') return PAYMENT_ERROR_CODES.PERMISSION_DENIED
    if (code === 'PGRST116') return PAYMENT_ERROR_CODES.NOT_FOUND
    if (code === '23514' || code === '22P02') return PAYMENT_ERROR_CODES.INVALID_INPUT

    if (message.includes('invalid input value for enum')) {
      return PAYMENT_ERROR_CODES.PROVIDER_UNSUPPORTED
    }
    if (message.includes('not authenticated') || message.includes('jwt')) {
      return PAYMENT_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('access denied') || message.includes('permission') || message.includes('row-level security')) {
      return PAYMENT_ERROR_CODES.PERMISSION_DENIED
    }
    if (message.includes('not found') || message.includes('no rows')) {
      return PAYMENT_ERROR_CODES.NOT_FOUND
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return PAYMENT_ERROR_CODES.NETWORK
    }
    if (message.includes('required') || message.includes('invalid')) {
      return PAYMENT_ERROR_CODES.INVALID_INPUT
    }
  }

  return PAYMENT_ERROR_CODES.UNKNOWN
}

export function toFriendlyPaymentError(error: unknown, fallback?: string): string {
  if (error instanceof PaymentError) return error.message

  const code = classifyPaymentError(error)

  if (code === PAYMENT_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? PAYMENT_ERROR_MESSAGES[PAYMENT_ERROR_CODES.UNKNOWN]
  }

  return PAYMENT_ERROR_MESSAGES[code]
}
