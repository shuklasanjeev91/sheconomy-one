/**
 * Centralised listing-review error handling.
 *
 * Raw Supabase failures are routed through `toFriendlyListingReviewError` so
 * toasts, banners, and error boundaries always show actionable copy.
 */

export const LISTING_REVIEW_ERROR_CODES = {
  NOT_AUTHENTICATED: 'listing-reviews/not-authenticated',
  ACCESS_DENIED: 'listing-reviews/access-denied',
  MODERATION_DENIED: 'listing-reviews/moderation-denied',
  REVIEW_ACCESS_DENIED: 'listing-reviews/review-access-denied',
  LISTING_NOT_FOUND: 'listing-reviews/listing-not-found',
  REVIEW_NOT_FOUND: 'listing-reviews/review-not-found',
  REPLY_NOT_FOUND: 'listing-reviews/reply-not-found',
  ALREADY_REVIEWED: 'listing-reviews/already-reviewed',
  CANNOT_REVIEW_OWN: 'listing-reviews/cannot-review-own',
  PENDING_ONLY: 'listing-reviews/pending-only',
  INVALID_INPUT: 'listing-reviews/invalid-input',
  DUPLICATE: 'listing-reviews/duplicate',
  NETWORK: 'listing-reviews/network',
  DATABASE: 'listing-reviews/database',
  UNKNOWN: 'listing-reviews/unknown',
} as const

export type ListingReviewErrorCode =
  (typeof LISTING_REVIEW_ERROR_CODES)[keyof typeof LISTING_REVIEW_ERROR_CODES]

export const LISTING_REVIEW_ERROR_MESSAGES: Record<ListingReviewErrorCode, string> = {
  [LISTING_REVIEW_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage reviews.',
  [LISTING_REVIEW_ERROR_CODES.ACCESS_DENIED]:
    'You do not have permission to perform this action on these reviews.',
  [LISTING_REVIEW_ERROR_CODES.MODERATION_DENIED]:
    'Only shop owners and admins can moderate listing reviews.',
  [LISTING_REVIEW_ERROR_CODES.REVIEW_ACCESS_DENIED]:
    'This review was not found or you do not have permission to change it.',
  [LISTING_REVIEW_ERROR_CODES.LISTING_NOT_FOUND]:
    'This listing was not found or is no longer available.',
  [LISTING_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND]:
    'We could not find that review. It may have been removed.',
  [LISTING_REVIEW_ERROR_CODES.REPLY_NOT_FOUND]:
    'We could not find that reply. It may have been removed.',
  [LISTING_REVIEW_ERROR_CODES.ALREADY_REVIEWED]: 'You have already reviewed this listing.',
  [LISTING_REVIEW_ERROR_CODES.CANNOT_REVIEW_OWN]: 'You cannot review your own listing.',
  [LISTING_REVIEW_ERROR_CODES.PENDING_ONLY]:
    'Only pending reviews can be edited or deleted by the reviewer.',
  [LISTING_REVIEW_ERROR_CODES.INVALID_INPUT]:
    'Some review details look invalid. Please review the highlighted fields.',
  [LISTING_REVIEW_ERROR_CODES.DUPLICATE]: 'You have already submitted this review.',
  [LISTING_REVIEW_ERROR_CODES.NETWORK]: 'Network issue — check your connection and try again.',
  [LISTING_REVIEW_ERROR_CODES.DATABASE]:
    'We could not save your review due to a database error. Please try again.',
  [LISTING_REVIEW_ERROR_CODES.UNKNOWN]:
    'Something went wrong with reviews. Please try again shortly.',
}

export class ListingReviewError extends Error {
  readonly code: ListingReviewErrorCode

  constructor(code: ListingReviewErrorCode, message?: string) {
    super(message ?? LISTING_REVIEW_ERROR_MESSAGES[code])
    this.name = 'ListingReviewError'
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

export function classifyListingReviewError(error: unknown): ListingReviewErrorCode {
  if (error instanceof ListingReviewError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '23505') return LISTING_REVIEW_ERROR_CODES.DUPLICATE
    if (code === '42501') return LISTING_REVIEW_ERROR_CODES.ACCESS_DENIED
    if (code === 'PGRST116') return LISTING_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND
    if (code === '23514' || code === '22P02') return LISTING_REVIEW_ERROR_CODES.INVALID_INPUT

    if (message.includes('not authenticated') || message.includes('jwt')) {
      return LISTING_REVIEW_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('already reviewed')) {
      return LISTING_REVIEW_ERROR_CODES.ALREADY_REVIEWED
    }
    if (message.includes('cannot review own') || message.includes('own listing')) {
      return LISTING_REVIEW_ERROR_CODES.CANNOT_REVIEW_OWN
    }
    if (message.includes('access denied') || message.includes('permission') || message.includes('row-level security')) {
      return LISTING_REVIEW_ERROR_CODES.ACCESS_DENIED
    }
    if (message.includes('not found') || message.includes('no rows')) {
      return LISTING_REVIEW_ERROR_CODES.REVIEW_NOT_FOUND
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return LISTING_REVIEW_ERROR_CODES.NETWORK
    }
    if (message.includes('required') || message.includes('invalid')) {
      return LISTING_REVIEW_ERROR_CODES.INVALID_INPUT
    }
  }

  return LISTING_REVIEW_ERROR_CODES.UNKNOWN
}

export function toFriendlyListingReviewError(error: unknown, fallback?: string): string {
  if (error instanceof ListingReviewError) return error.message

  const code = classifyListingReviewError(error)

  if (code === LISTING_REVIEW_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? LISTING_REVIEW_ERROR_MESSAGES[LISTING_REVIEW_ERROR_CODES.UNKNOWN]
  }

  return LISTING_REVIEW_ERROR_MESSAGES[code]
}
