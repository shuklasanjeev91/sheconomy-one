/**
 * Centralised order error handling.
 *
 * Raw Supabase / network errors funnel through `toFriendlyOrderError` so the UI
 * (toasts, banners, the VendorOrderErrorBoundary) always shows a human,
 * actionable message instead of a Postgres code. Mirrors `shop.errors`.
 */

/** Stable, translatable error keys for known order failure modes. */
export const ORDER_ERROR_CODES = {
  NOT_AUTHENTICATED: 'order/not-authenticated',
  NOT_FOUND: 'order/not-found',
  ITEM_NOT_FOUND: 'order/item-not-found',
  PERMISSION_DENIED: 'order/permission-denied',
  SHOP_ACCESS_DENIED: 'order/shop-access-denied',
  INVALID_STATUS_TRANSITION: 'order/invalid-status-transition',
  INVALID_INPUT: 'order/invalid-input',
  NETWORK: 'order/network',
  UNKNOWN: 'order/unknown',
} as const

export type OrderErrorCode = (typeof ORDER_ERROR_CODES)[keyof typeof ORDER_ERROR_CODES]

/** User-facing copy for each known code. */
export const ORDER_ERROR_MESSAGES: Record<OrderErrorCode, string> = {
  [ORDER_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage orders.',
  [ORDER_ERROR_CODES.NOT_FOUND]: 'We couldn’t find that order. It may have been removed.',
  [ORDER_ERROR_CODES.ITEM_NOT_FOUND]: 'We couldn’t find that order item.',
  [ORDER_ERROR_CODES.PERMISSION_DENIED]:
    'You don’t have permission to do that. Only the seller or an admin can manage this order.',
  [ORDER_ERROR_CODES.SHOP_ACCESS_DENIED]: 'Shop not found, or you don’t have access to its orders.',
  [ORDER_ERROR_CODES.INVALID_STATUS_TRANSITION]:
    'That status change isn’t allowed from the current status.',
  [ORDER_ERROR_CODES.INVALID_INPUT]: 'Some details are invalid. Please review and try again.',
  [ORDER_ERROR_CODES.NETWORK]: 'Network issue — please check your connection and try again.',
  [ORDER_ERROR_CODES.UNKNOWN]: 'Something went wrong with this order. Please try again shortly.',
}

/** An order error that carries a stable code alongside the friendly message. */
export class OrderError extends Error {
  readonly code: OrderErrorCode

  constructor(code: OrderErrorCode, message?: string) {
    super(message ?? ORDER_ERROR_MESSAGES[code])
    this.name = 'OrderError'
    this.code = code
  }
}

export function createOrderError(code: OrderErrorCode, message?: string): OrderError {
  return new OrderError(code, message)
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

/**
 * Map a raw Supabase error to a stable order error code using its Postgres code
 * first, then falling back to well-known message fragments.
 */
export function classifyOrderError(error: unknown): OrderErrorCode {
  if (error instanceof OrderError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '42501') return ORDER_ERROR_CODES.PERMISSION_DENIED
    if (code === 'PGRST116') return ORDER_ERROR_CODES.NOT_FOUND
    if (code === '23514' || code === '22P02') return ORDER_ERROR_CODES.INVALID_INPUT

    if (message.includes('not authenticated') || message.includes('jwt')) {
      return ORDER_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('permission') || message.includes('row-level security')) {
      return ORDER_ERROR_CODES.PERMISSION_DENIED
    }
    if (message.includes('access denied')) return ORDER_ERROR_CODES.SHOP_ACCESS_DENIED
    if (message.includes('status transition') || message.includes('cannot transition')) {
      return ORDER_ERROR_CODES.INVALID_STATUS_TRANSITION
    }
    if (message.includes('no rows') || message.includes('not found')) {
      return ORDER_ERROR_CODES.NOT_FOUND
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return ORDER_ERROR_CODES.NETWORK
    }
  }

  return ORDER_ERROR_CODES.UNKNOWN
}

/**
 * Turn any thrown value / Supabase error into a friendly, user-facing message.
 * Prefers a caller-supplied fallback when the underlying error is generic.
 */
export function toFriendlyOrderError(error: unknown, fallback?: string): string {
  if (error instanceof OrderError) return error.message

  const code = classifyOrderError(error)

  if (code === ORDER_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? ORDER_ERROR_MESSAGES[ORDER_ERROR_CODES.UNKNOWN]
  }

  return ORDER_ERROR_MESSAGES[code]
}
