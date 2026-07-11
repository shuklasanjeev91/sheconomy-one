/**
 * Centralised listing error handling.
 *
 * Everything listing-related funnels raw Supabase / network errors through
 * `toFriendlyListingError` so the UI (toasts, banners, the ListingErrorBoundary)
 * always shows a human, actionable message instead of a Postgres code.
 *
 * Mirrors `shop.errors` so the two modules stay symmetric.
 */

/** Stable, translatable error keys for known listing failure modes. */
export const LISTING_ERROR_CODES = {
  NOT_AUTHENTICATED: 'listing/not-authenticated',
  NOT_FOUND: 'listing/not-found',
  PERMISSION_DENIED: 'listing/permission-denied',
  ACCESS_DENIED: 'listing/access-denied',
  SHOP_ACCESS_DENIED: 'listing/shop-access-denied',
  DUPLICATE: 'listing/duplicate',
  SLUG_TAKEN: 'listing/slug-taken',
  INVALID_INPUT: 'listing/invalid-input',
  INVALID_TYPE: 'listing/invalid-type',
  OUT_OF_STOCK: 'listing/out-of-stock',
  INSUFFICIENT_STOCK: 'listing/insufficient-stock',
  NSFW_CONTENT: 'listing/nsfw-content',
  IMAGE_TOO_LARGE: 'listing/image-too-large',
  INVALID_IMAGE_TYPE: 'listing/invalid-image-type',
  UPLOAD_FAILED: 'listing/upload-failed',
  NETWORK: 'listing/network',
  UNKNOWN: 'listing/unknown',
} as const

export type ListingErrorCode = (typeof LISTING_ERROR_CODES)[keyof typeof LISTING_ERROR_CODES]

/** User-facing copy for each known code. */
export const LISTING_ERROR_MESSAGES: Record<ListingErrorCode, string> = {
  [LISTING_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage listings.',
  [LISTING_ERROR_CODES.NOT_FOUND]: 'We couldn’t find that listing. It may have been removed.',
  [LISTING_ERROR_CODES.PERMISSION_DENIED]:
    'You don’t have permission to do that. Only the shop owner or an admin can manage this listing.',
  [LISTING_ERROR_CODES.ACCESS_DENIED]: 'Listing not found or access denied.',
  [LISTING_ERROR_CODES.SHOP_ACCESS_DENIED]:
    'That shop wasn’t found or you don’t have access to it.',
  [LISTING_ERROR_CODES.DUPLICATE]: 'That listing already exists.',
  [LISTING_ERROR_CODES.SLUG_TAKEN]:
    'A listing with that link already exists. Try a slightly different title.',
  [LISTING_ERROR_CODES.INVALID_INPUT]:
    'Some listing details are invalid. Please review the form and try again.',
  [LISTING_ERROR_CODES.INVALID_TYPE]:
    'Invalid listing type. Choose physical, digital, or service.',
  [LISTING_ERROR_CODES.OUT_OF_STOCK]: 'This item is currently out of stock.',
  [LISTING_ERROR_CODES.INSUFFICIENT_STOCK]: 'There isn’t enough stock for that quantity.',
  [LISTING_ERROR_CODES.NSFW_CONTENT]:
    'One or more images were flagged as inappropriate and can’t be used. Please choose different images.',
  [LISTING_ERROR_CODES.IMAGE_TOO_LARGE]: 'That image is too large. Please use one under 10 MB.',
  [LISTING_ERROR_CODES.INVALID_IMAGE_TYPE]:
    'Unsupported image type. Use JPEG, PNG, WebP, or GIF.',
  [LISTING_ERROR_CODES.UPLOAD_FAILED]: 'We couldn’t upload your image. Please try again.',
  [LISTING_ERROR_CODES.NETWORK]:
    'Network issue — please check your connection and try again.',
  [LISTING_ERROR_CODES.UNKNOWN]: 'Something went wrong with this listing. Please try again shortly.',
}

/** A listing error that carries a stable code alongside the friendly message. */
export class ListingError extends Error {
  readonly code: ListingErrorCode

  constructor(code: ListingErrorCode, message?: string) {
    super(message ?? LISTING_ERROR_MESSAGES[code])
    this.name = 'ListingError'
    this.code = code
  }
}

export function createListingError(code: ListingErrorCode, message?: string): ListingError {
  return new ListingError(code, message)
}

/** Shape we can extract a Postgres code / message from, without `any`. */
type SupabaseLikeError = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

function isSupabaseLikeError(value: unknown): value is SupabaseLikeError {
  return typeof value === 'object' && value !== null && ('message' in value || 'code' in value)
}

/**
 * Map a raw Supabase error to a stable listing error code using its Postgres
 * code first, then falling back to well-known message fragments.
 */
export function classifyListingError(error: unknown): ListingErrorCode {
  if (error instanceof ListingError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    // Postgres / PostgREST codes.
    if (code === '23505') {
      return message.includes('slug')
        ? LISTING_ERROR_CODES.SLUG_TAKEN
        : LISTING_ERROR_CODES.DUPLICATE
    }
    if (code === '42501') return LISTING_ERROR_CODES.PERMISSION_DENIED
    if (code === 'PGRST116') return LISTING_ERROR_CODES.NOT_FOUND
    if (code === '23514' || code === '22P02') return LISTING_ERROR_CODES.INVALID_INPUT

    // Message-based fallbacks.
    if (message.includes('nsfw') || message.includes('inappropriate')) {
      return LISTING_ERROR_CODES.NSFW_CONTENT
    }
    if (message.includes('not authenticated') || message.includes('jwt')) {
      return LISTING_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('permission') || message.includes('row-level security')) {
      return LISTING_ERROR_CODES.PERMISSION_DENIED
    }
    if (message.includes('access denied')) return LISTING_ERROR_CODES.ACCESS_DENIED
    if (message.includes('no rows') || message.includes('not found')) {
      return LISTING_ERROR_CODES.NOT_FOUND
    }
    if (message.includes('out of stock')) return LISTING_ERROR_CODES.OUT_OF_STOCK
    if (message.includes('insufficient stock')) return LISTING_ERROR_CODES.INSUFFICIENT_STOCK
    if (message.includes('too large')) return LISTING_ERROR_CODES.IMAGE_TOO_LARGE
    if (message.includes('invalid file type') || message.includes('unsupported image')) {
      return LISTING_ERROR_CODES.INVALID_IMAGE_TYPE
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return LISTING_ERROR_CODES.NETWORK
    }
  }

  return LISTING_ERROR_CODES.UNKNOWN
}

/**
 * Turn any thrown value / Supabase error into a friendly, user-facing message.
 * Prefers a caller-supplied context prefix when the underlying error is generic.
 */
export function toFriendlyListingError(error: unknown, fallback?: string): string {
  if (error instanceof ListingError) return error.message

  const code = classifyListingError(error)

  if (code === LISTING_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? LISTING_ERROR_MESSAGES[LISTING_ERROR_CODES.UNKNOWN]
  }

  return LISTING_ERROR_MESSAGES[code]
}
