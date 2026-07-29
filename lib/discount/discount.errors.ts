/**
 * Centralised discount error handling.
 *
 * Ported from legacy `discountUtils.js` ERRORS object and service fallbacks.
 */

export const DISCOUNT_ERROR_CODES = {
  NOT_AUTHENTICATED: 'discount/not-authenticated',
  ACCESS_DENIED: 'discount/access-denied',
  SHOP_NOT_FOUND: 'discount/shop-not-found',
  DISCOUNT_NOT_FOUND: 'discount/not-found',
  INVALID_ID: 'discount/invalid-id',
  INVALID_CODE: 'discount/invalid-code',
  INVALID_INPUT: 'discount/invalid-input',
  VALIDATION_ERROR: 'discount/validation-error',
  USAGE_EXCEEDED: 'discount/usage-exceeded',
  CUSTOMER_LIMIT: 'discount/customer-limit',
  MIN_ORDER: 'discount/min-order',
  INACTIVE: 'discount/inactive',
  EXPIRED: 'discount/expired',
  NOT_STARTED: 'discount/not-started',
  NOT_ELIGIBLE: 'discount/not-eligible',
  NO_ELIGIBLE_ITEMS: 'discount/no-eligible-items',
  BOGO_ELIGIBILITY: 'discount/bogo-eligibility',
  LINK_FAILED: 'discount/link-failed',
  POSTER_INVALID: 'discount/poster-invalid',
  POSTER_NOT_FOUND: 'discount/poster-not-found',
  BULK_FAILED: 'discount/bulk-failed',
  NETWORK: 'discount/network',
  TIMEOUT: 'discount/timeout',
  DATABASE: 'discount/database',
  UNKNOWN: 'discount/unknown',
} as const

export type DiscountErrorCode = (typeof DISCOUNT_ERROR_CODES)[keyof typeof DISCOUNT_ERROR_CODES]

export const DISCOUNT_ERROR_MESSAGES: Record<DiscountErrorCode, string> = {
  [DISCOUNT_ERROR_CODES.NOT_AUTHENTICATED]:
    'Please sign in to manage or apply discounts.',
  [DISCOUNT_ERROR_CODES.ACCESS_DENIED]:
    'You do not have permission to manage discounts for this shop.',
  [DISCOUNT_ERROR_CODES.SHOP_NOT_FOUND]:
    'This shop was not found or is no longer available.',
  [DISCOUNT_ERROR_CODES.DISCOUNT_NOT_FOUND]:
    'We could not find that discount. It may have been removed.',
  [DISCOUNT_ERROR_CODES.INVALID_ID]: 'Invalid or missing discount ID.',
  [DISCOUNT_ERROR_CODES.INVALID_CODE]: 'Invalid or expired discount code.',
  [DISCOUNT_ERROR_CODES.INVALID_INPUT]:
    'Some discount details look invalid. Please review the highlighted fields.',
  [DISCOUNT_ERROR_CODES.VALIDATION_ERROR]: 'Validation failed. Please check your input.',
  [DISCOUNT_ERROR_CODES.USAGE_EXCEEDED]: 'Discount usage limit exceeded.',
  [DISCOUNT_ERROR_CODES.CUSTOMER_LIMIT]: 'Customer usage limit exceeded for this discount.',
  [DISCOUNT_ERROR_CODES.MIN_ORDER]: 'Minimum order amount not met.',
  [DISCOUNT_ERROR_CODES.INACTIVE]: 'Discount is inactive.',
  [DISCOUNT_ERROR_CODES.EXPIRED]: 'Discount has expired.',
  [DISCOUNT_ERROR_CODES.NOT_STARTED]: 'Discount is not yet active.',
  [DISCOUNT_ERROR_CODES.NOT_ELIGIBLE]: 'Not eligible for this discount.',
  [DISCOUNT_ERROR_CODES.NO_ELIGIBLE_ITEMS]: 'No eligible items in cart.',
  [DISCOUNT_ERROR_CODES.BOGO_ELIGIBILITY]: 'This BOGO code is not eligible for your current cart.',
  [DISCOUNT_ERROR_CODES.LINK_FAILED]:
    'We could not link this discount to the selected listings.',
  [DISCOUNT_ERROR_CODES.POSTER_INVALID]: 'The poster file or dimensions are invalid.',
  [DISCOUNT_ERROR_CODES.POSTER_NOT_FOUND]: 'Poster not found.',
  [DISCOUNT_ERROR_CODES.BULK_FAILED]: 'Bulk discount operation failed. Please try again.',
  [DISCOUNT_ERROR_CODES.NETWORK]: 'Network issue — check your connection and try again.',
  [DISCOUNT_ERROR_CODES.TIMEOUT]: 'Request timeout — please try again.',
  [DISCOUNT_ERROR_CODES.DATABASE]:
    'We could not complete the discount operation due to a database error.',
  [DISCOUNT_ERROR_CODES.UNKNOWN]:
    'Something went wrong with discounts. Please try again shortly.',
}

/** Legacy-compatible error keys used by calculation/eligibility helpers. */
export const DISCOUNT_ELIGIBILITY_ERRORS = {
  INVALID_ID: DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.INVALID_ID],
  INVALID_CODE: DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.INVALID_CODE],
  USAGE_EXCEEDED: DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.USAGE_EXCEEDED],
  CUSTOMER_LIMIT: DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.CUSTOMER_LIMIT],
  MIN_ORDER: DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.MIN_ORDER],
  INACTIVE: DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.INACTIVE],
  EXPIRED: DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.EXPIRED],
  NOT_STARTED: DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.NOT_STARTED],
  NOT_ELIGIBLE: DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.NOT_ELIGIBLE],
  NO_ELIGIBLE_ITEMS: DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.NO_ELIGIBLE_ITEMS],
} as const

export class DiscountError extends Error {
  readonly code: DiscountErrorCode

  constructor(code: DiscountErrorCode, message?: string) {
    super(message ?? DISCOUNT_ERROR_MESSAGES[code])
    this.name = 'DiscountError'
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

export function classifyDiscountError(error: unknown): DiscountErrorCode {
  if (error instanceof DiscountError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '42501') return DISCOUNT_ERROR_CODES.ACCESS_DENIED
    if (code === 'PGRST116') return DISCOUNT_ERROR_CODES.DISCOUNT_NOT_FOUND
    if (code === '23514' || code === '22P02') return DISCOUNT_ERROR_CODES.INVALID_INPUT

    if (message.includes('not authenticated') || message.includes('jwt')) {
      return DISCOUNT_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('access denied') || message.includes('permission') || message.includes('row-level security')) {
      return DISCOUNT_ERROR_CODES.ACCESS_DENIED
    }
    if (message.includes('shop not found') || message.includes('no shop')) {
      return DISCOUNT_ERROR_CODES.SHOP_NOT_FOUND
    }
    if (message.includes('discount not found') || message.includes('not found') || message.includes('no rows')) {
      return DISCOUNT_ERROR_CODES.DISCOUNT_NOT_FOUND
    }
    if (message.includes('invalid or expired discount code')) {
      return DISCOUNT_ERROR_CODES.INVALID_CODE
    }
    if (message.includes('usage limit exceeded')) {
      return DISCOUNT_ERROR_CODES.USAGE_EXCEEDED
    }
    if (message.includes('customer usage limit')) {
      return DISCOUNT_ERROR_CODES.CUSTOMER_LIMIT
    }
    if (message.includes('minimum order')) {
      return DISCOUNT_ERROR_CODES.MIN_ORDER
    }
    if (message.includes('query timeout') || message.includes('timeout')) {
      return DISCOUNT_ERROR_CODES.TIMEOUT
    }
    if (message.includes('network') || message.includes('fetch')) {
      return DISCOUNT_ERROR_CODES.NETWORK
    }
    if (message.includes('required') || message.includes('invalid')) {
      return DISCOUNT_ERROR_CODES.INVALID_INPUT
    }
  }

  return DISCOUNT_ERROR_CODES.UNKNOWN
}

export function toFriendlyDiscountError(error: unknown, fallback?: string): string {
  if (error instanceof DiscountError) return error.message

  const code = classifyDiscountError(error)

  if (code === DISCOUNT_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? DISCOUNT_ERROR_MESSAGES[DISCOUNT_ERROR_CODES.UNKNOWN]
  }

  return DISCOUNT_ERROR_MESSAGES[code]
}
