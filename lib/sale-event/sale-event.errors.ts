/**
 * Centralised sale-event error handling.
 *
 * Every service failure funnels raw Supabase / network errors through
 * `toFriendlySaleError` so the UI (toasts, banners, `SaleEventErrorBoundary`) always
 * shows a human, actionable message instead of a Postgres code.
 */

/** Stable, translatable error keys for known sale failure modes. */
export const SALE_ERROR_CODES = {
  NOT_AUTHENTICATED: 'sale/not-authenticated',
  NOT_FOUND: 'sale/not-found',
  PERMISSION_DENIED: 'sale/permission-denied',
  DUPLICATE_ENROLLMENT: 'sale/duplicate-enrollment',
  SLUG_TAKEN: 'sale/slug-taken',
  EVENT_INACTIVE: 'sale/event-inactive',
  REGISTRATION_CLOSED: 'sale/registration-closed',
  INVALID_INPUT: 'sale/invalid-input',
  NETWORK: 'sale/network',
  UNKNOWN: 'sale/unknown',
} as const

export type SaleErrorCode = (typeof SALE_ERROR_CODES)[keyof typeof SALE_ERROR_CODES]

/** User-facing copy for each known code. */
export const SALE_ERROR_MESSAGES: Record<SaleErrorCode, string> = {
  [SALE_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage sale events.',
  [SALE_ERROR_CODES.NOT_FOUND]: 'We couldn’t find that sale event. It may have been removed.',
  [SALE_ERROR_CODES.PERMISSION_DENIED]:
    'You don’t have permission to do that. Only an admin can manage events; vendors can only manage their own enrollments.',
  [SALE_ERROR_CODES.DUPLICATE_ENROLLMENT]: 'This shop is already enrolled in that event.',
  [SALE_ERROR_CODES.SLUG_TAKEN]: 'An event with that slug already exists. Try a different name.',
  [SALE_ERROR_CODES.EVENT_INACTIVE]: 'This event isn’t active, so you can’t join it right now.',
  [SALE_ERROR_CODES.REGISTRATION_CLOSED]: 'Registration for this event is closed.',
  [SALE_ERROR_CODES.INVALID_INPUT]: 'Some details are invalid. Please review and try again.',
  [SALE_ERROR_CODES.NETWORK]: 'Network issue — please check your connection and try again.',
  [SALE_ERROR_CODES.UNKNOWN]: 'Something went wrong with the sale event. Please try again shortly.',
}

/** A sale error that carries a stable code alongside the friendly message. */
export class SaleError extends Error {
  readonly code: SaleErrorCode

  constructor(code: SaleErrorCode, message?: string) {
    super(message ?? SALE_ERROR_MESSAGES[code])
    this.name = 'SaleError'
    this.code = code
  }
}

export function createSaleError(code: SaleErrorCode, message?: string): SaleError {
  return new SaleError(code, message)
}

type SupabaseLikeError = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

function isSupabaseLikeError(value: unknown): value is SupabaseLikeError {
  return typeof value === 'object' && value !== null && ('message' in value || 'code' in value)
}

/** Map a raw error to a stable sale error code (Postgres code first, then message). */
export function classifySaleError(error: unknown): SaleErrorCode {
  if (error instanceof SaleError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '23505') {
      if (message.includes('event_slug') || message.includes('slug')) return SALE_ERROR_CODES.SLUG_TAKEN
      return SALE_ERROR_CODES.DUPLICATE_ENROLLMENT
    }
    if (code === '42501') return SALE_ERROR_CODES.PERMISSION_DENIED
    if (code === 'PGRST116') return SALE_ERROR_CODES.NOT_FOUND
    if (code === '23514' || code === '22P02' || code === '23503') return SALE_ERROR_CODES.INVALID_INPUT

    if (message.includes('not authenticated') || message.includes('jwt')) {
      return SALE_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('permission') || message.includes('row-level security')) {
      return SALE_ERROR_CODES.PERMISSION_DENIED
    }
    if (message.includes('no rows') || message.includes('not found')) {
      return SALE_ERROR_CODES.NOT_FOUND
    }
    if (message.includes('already enrolled') || message.includes('duplicate')) {
      return SALE_ERROR_CODES.DUPLICATE_ENROLLMENT
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return SALE_ERROR_CODES.NETWORK
    }
  }

  return SALE_ERROR_CODES.UNKNOWN
}

/**
 * Turn any thrown value / Supabase error into a friendly, user-facing message.
 * Prefers a caller-supplied context prefix when the underlying error is generic.
 */
export function toFriendlySaleError(error: unknown, fallback?: string): string {
  if (error instanceof SaleError) return error.message

  const code = classifySaleError(error)

  if (code === SALE_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? SALE_ERROR_MESSAGES[SALE_ERROR_CODES.UNKNOWN]
  }

  return SALE_ERROR_MESSAGES[code]
}
