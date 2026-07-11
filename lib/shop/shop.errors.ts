/**
 * Centralised shop error handling.
 *
 * Everything shop-related funnels raw Supabase / network errors through
 * `toFriendlyShopError` so the UI (toasts, banners, the ShopErrorBoundary)
 * always shows a human, actionable message instead of a Postgres code.
 */

/** Stable, translatable error keys for known shop failure modes. */
export const SHOP_ERROR_CODES = {
  NOT_AUTHENTICATED: 'shop/not-authenticated',
  NOT_FOUND: 'shop/not-found',
  PERMISSION_DENIED: 'shop/permission-denied',
  DUPLICATE: 'shop/duplicate',
  ALREADY_FOLLOWING: 'shop/already-following',
  CANNOT_FOLLOW_OWN: 'shop/cannot-follow-own',
  INVALID_INPUT: 'shop/invalid-input',
  NAME_TAKEN: 'shop/name-taken',
  NETWORK: 'shop/network',
  UNKNOWN: 'shop/unknown',
} as const

export type ShopErrorCode = (typeof SHOP_ERROR_CODES)[keyof typeof SHOP_ERROR_CODES]

/** User-facing copy for each known code. */
export const SHOP_ERROR_MESSAGES: Record<ShopErrorCode, string> = {
  [SHOP_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage your shop.',
  [SHOP_ERROR_CODES.NOT_FOUND]: 'We couldn’t find that shop. It may have been removed.',
  [SHOP_ERROR_CODES.PERMISSION_DENIED]:
    'You don’t have permission to do that. Only the shop owner or an admin can make this change.',
  [SHOP_ERROR_CODES.DUPLICATE]: 'That already exists.',
  [SHOP_ERROR_CODES.ALREADY_FOLLOWING]: 'You’re already following this shop.',
  [SHOP_ERROR_CODES.CANNOT_FOLLOW_OWN]: 'You can’t follow your own shop.',
  [SHOP_ERROR_CODES.INVALID_INPUT]: 'Some shop details are invalid. Please review and try again.',
  [SHOP_ERROR_CODES.NAME_TAKEN]: 'A shop with that name already exists. Try a different name.',
  [SHOP_ERROR_CODES.NETWORK]: 'Network issue — please check your connection and try again.',
  [SHOP_ERROR_CODES.UNKNOWN]: 'Something went wrong with your shop. Please try again shortly.',
}

/** A shop error that carries a stable code alongside the friendly message. */
export class ShopError extends Error {
  readonly code: ShopErrorCode

  constructor(code: ShopErrorCode, message?: string) {
    super(message ?? SHOP_ERROR_MESSAGES[code])
    this.name = 'ShopError'
    this.code = code
  }
}

export function createShopError(code: ShopErrorCode, message?: string): ShopError {
  return new ShopError(code, message)
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
 * Map a raw Supabase error to a stable shop error code using its Postgres code
 * first, then falling back to well-known message fragments.
 */
export function classifyShopError(error: unknown): ShopErrorCode {
  if (error instanceof ShopError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    // Postgres / PostgREST codes.
    if (code === '23505') {
      return message.includes('name') ? SHOP_ERROR_CODES.NAME_TAKEN : SHOP_ERROR_CODES.DUPLICATE
    }
    if (code === '42501') return SHOP_ERROR_CODES.PERMISSION_DENIED
    if (code === 'PGRST116') return SHOP_ERROR_CODES.NOT_FOUND
    if (code === '23514' || code === '22P02') return SHOP_ERROR_CODES.INVALID_INPUT

    // Message-based fallbacks.
    if (message.includes('not authenticated') || message.includes('jwt')) {
      return SHOP_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('permission') || message.includes('row-level security')) {
      return SHOP_ERROR_CODES.PERMISSION_DENIED
    }
    if (message.includes('no rows') || message.includes('not found')) {
      return SHOP_ERROR_CODES.NOT_FOUND
    }
    if (message.includes('already following')) return SHOP_ERROR_CODES.ALREADY_FOLLOWING
    if (message.includes('own shop')) return SHOP_ERROR_CODES.CANNOT_FOLLOW_OWN
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return SHOP_ERROR_CODES.NETWORK
    }
  }

  return SHOP_ERROR_CODES.UNKNOWN
}

/**
 * Turn any thrown value / Supabase error into a friendly, user-facing message.
 * Prefers a caller-supplied context prefix (e.g. "Couldn’t update shop") when
 * the underlying error is generic.
 */
export function toFriendlyShopError(error: unknown, fallback?: string): string {
  if (error instanceof ShopError) return error.message

  const code = classifyShopError(error)

  // For genuinely unknown errors, surface the raw message if it looks helpful.
  if (code === SHOP_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? SHOP_ERROR_MESSAGES[SHOP_ERROR_CODES.UNKNOWN]
  }

  return SHOP_ERROR_MESSAGES[code]
}
