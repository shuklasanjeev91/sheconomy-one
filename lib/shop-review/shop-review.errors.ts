/**
 * Centralised shop-review error handling.
 */

export const SHOP_REVIEW_ERROR_CODES = {
  NOT_AUTHENTICATED: 'shop-review/not-authenticated',
  ACCESS_DENIED: 'shop-review/access-denied',
  MODERATION_DENIED: 'shop-review/moderation-denied',
  REVIEW_ACCESS_DENIED: 'shop-review/review-access-denied',
  SHOP_NOT_FOUND: 'shop-review/shop-not-found',
  REVIEW_NOT_FOUND: 'shop-review/review-not-found',
  RESPONSE_EXISTS: 'shop-review/response-exists',
  ALREADY_REVIEWED: 'shop-review/already-reviewed',
  CANNOT_REVIEW_OWN: 'shop-review/cannot-review-own',
  PENDING_ONLY: 'shop-review/pending-only',
  ALREADY_REPORTED: 'shop-review/already-reported',
  INVALID_INPUT: 'shop-review/invalid-input',
  DUPLICATE: 'shop-review/duplicate',
  NETWORK: 'shop-review/network',
  DATABASE: 'shop-review/database',
  UNKNOWN: 'shop-review/unknown',
} as const

export type ShopReviewErrorCode =
  (typeof SHOP_REVIEW_ERROR_CODES)[keyof typeof SHOP_REVIEW_ERROR_CODES]

export const SHOP_REVIEW_ERROR_MESSAGES: Record<ShopReviewErrorCode, string> = {
  [SHOP_REVIEW_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage shop reviews.',
  [SHOP_REVIEW_ERROR_CODES.ACCESS_DENIED]:
    'You do not have permission to perform this action on these reviews.',
  [SHOP_REVIEW_ERROR_CODES.MODERATION_DENIED]:
    'Only shop owners and admins can moderate shop reviews.',
  [SHOP_REVIEW_ERROR_CODES.REVIEW_ACCESS_DENIED]:
    'This review was not found or you do not have permission to change it.',
  [SHOP_REVIEW_ERROR_CODES.SHOP_NOT_FOUND]:
    'This shop was not found or is no longer available.',
  [SHOP_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND]:
    'We could not find that review. It may have been removed.',
  [SHOP_REVIEW_ERROR_CODES.RESPONSE_EXISTS]:
    'This review already has a shop response.',
  [SHOP_REVIEW_ERROR_CODES.ALREADY_REVIEWED]: 'You have already reviewed this shop.',
  [SHOP_REVIEW_ERROR_CODES.CANNOT_REVIEW_OWN]: 'You cannot review your own shop.',
  [SHOP_REVIEW_ERROR_CODES.PENDING_ONLY]:
    'Only pending reviews can be edited by the reviewer.',
  [SHOP_REVIEW_ERROR_CODES.ALREADY_REPORTED]: 'You have already reported this review.',
  [SHOP_REVIEW_ERROR_CODES.INVALID_INPUT]:
    'Some review details look invalid. Please review the highlighted fields.',
  [SHOP_REVIEW_ERROR_CODES.DUPLICATE]: 'You have already submitted this review.',
  [SHOP_REVIEW_ERROR_CODES.NETWORK]: 'Network issue — check your connection and try again.',
  [SHOP_REVIEW_ERROR_CODES.DATABASE]:
    'We could not save your review due to a database error. Please try again.',
  [SHOP_REVIEW_ERROR_CODES.UNKNOWN]:
    'Something went wrong with shop reviews. Please try again shortly.',
}

export class ShopReviewError extends Error {
  readonly code: ShopReviewErrorCode

  constructor(code: ShopReviewErrorCode, message?: string) {
    super(message ?? SHOP_REVIEW_ERROR_MESSAGES[code])
    this.name = 'ShopReviewError'
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

export function classifyShopReviewError(error: unknown): ShopReviewErrorCode {
  if (error instanceof ShopReviewError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '23505') return SHOP_REVIEW_ERROR_CODES.DUPLICATE
    if (code === '42501') return SHOP_REVIEW_ERROR_CODES.ACCESS_DENIED
    if (code === 'PGRST116') return SHOP_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND
    if (code === '23514' || code === '22P02') return SHOP_REVIEW_ERROR_CODES.INVALID_INPUT

    if (message.includes('not authenticated') || message.includes('jwt')) {
      return SHOP_REVIEW_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('already reviewed')) {
      return SHOP_REVIEW_ERROR_CODES.ALREADY_REVIEWED
    }
    if (message.includes('own shop')) {
      return SHOP_REVIEW_ERROR_CODES.CANNOT_REVIEW_OWN
    }
    if (message.includes('access denied') || message.includes('permission') || message.includes('row-level security')) {
      return SHOP_REVIEW_ERROR_CODES.ACCESS_DENIED
    }
    if (message.includes('not found') || message.includes('no rows')) {
      return SHOP_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return SHOP_REVIEW_ERROR_CODES.NETWORK
    }
    if (message.includes('required') || message.includes('invalid')) {
      return SHOP_REVIEW_ERROR_CODES.INVALID_INPUT
    }
  }

  return SHOP_REVIEW_ERROR_CODES.UNKNOWN
}

export function toFriendlyShopReviewError(error: unknown, fallback?: string): string {
  if (error instanceof ShopReviewError) return error.message

  const code = classifyShopReviewError(error)

  if (code === SHOP_REVIEW_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? SHOP_REVIEW_ERROR_MESSAGES[SHOP_REVIEW_ERROR_CODES.UNKNOWN]
  }

  return SHOP_REVIEW_ERROR_MESSAGES[code]
}
