/**
 * Centralised sales analytics error handling.
 */

export const SALES_ANALYTICS_ERROR_CODES = {
  NOT_AUTHENTICATED: 'sales-analytics/not-authenticated',
  ACCESS_DENIED: 'sales-analytics/access-denied',
  SHOP_NOT_FOUND: 'sales-analytics/shop-not-found',
  RECORD_NOT_FOUND: 'sales-analytics/record-not-found',
  INVALID_INPUT: 'sales-analytics/invalid-input',
  INVALID_FILTERS: 'sales-analytics/invalid-filters',
  INVALID_EXPORT_FORMAT: 'sales-analytics/invalid-export-format',
  EXPORT_UNAVAILABLE: 'sales-analytics/export-unavailable',
  EXPORT_FAILED: 'sales-analytics/export-failed',
  NETWORK: 'sales-analytics/network',
  DATABASE: 'sales-analytics/database',
  UNKNOWN: 'sales-analytics/unknown',
} as const

export type SalesAnalyticsErrorCode =
  (typeof SALES_ANALYTICS_ERROR_CODES)[keyof typeof SALES_ANALYTICS_ERROR_CODES]

export const SALES_ANALYTICS_ERROR_MESSAGES: Record<SalesAnalyticsErrorCode, string> = {
  [SALES_ANALYTICS_ERROR_CODES.NOT_AUTHENTICATED]:
    'Please sign in to view sales analytics.',
  [SALES_ANALYTICS_ERROR_CODES.ACCESS_DENIED]:
    'You do not have permission to view or manage sales analytics for this shop.',
  [SALES_ANALYTICS_ERROR_CODES.SHOP_NOT_FOUND]:
    'This shop was not found or is no longer available.',
  [SALES_ANALYTICS_ERROR_CODES.RECORD_NOT_FOUND]:
    'We could not find that sales record. It may have been removed.',
  [SALES_ANALYTICS_ERROR_CODES.INVALID_INPUT]:
    'Some sales analytics details look invalid. Please review the highlighted fields.',
  [SALES_ANALYTICS_ERROR_CODES.INVALID_FILTERS]:
    'Some filter values are invalid. Please adjust your filters and try again.',
  [SALES_ANALYTICS_ERROR_CODES.INVALID_EXPORT_FORMAT]:
    'Please choose a valid export format.',
  [SALES_ANALYTICS_ERROR_CODES.EXPORT_UNAVAILABLE]:
    'That export format is not available in this environment.',
  [SALES_ANALYTICS_ERROR_CODES.EXPORT_FAILED]:
    'We could not export your sales data. Please try again.',
  [SALES_ANALYTICS_ERROR_CODES.NETWORK]:
    'Network issue — check your connection and try again.',
  [SALES_ANALYTICS_ERROR_CODES.DATABASE]:
    'We could not load sales analytics due to a database error. Please try again.',
  [SALES_ANALYTICS_ERROR_CODES.UNKNOWN]:
    'Something went wrong with sales analytics. Please try again shortly.',
}

export class SalesAnalyticsError extends Error {
  readonly code: SalesAnalyticsErrorCode

  constructor(code: SalesAnalyticsErrorCode, message?: string) {
    super(message ?? SALES_ANALYTICS_ERROR_MESSAGES[code])
    this.name = 'SalesAnalyticsError'
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

export function classifySalesAnalyticsError(error: unknown): SalesAnalyticsErrorCode {
  if (error instanceof SalesAnalyticsError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '42501') return SALES_ANALYTICS_ERROR_CODES.ACCESS_DENIED
    if (code === 'PGRST116') return SALES_ANALYTICS_ERROR_CODES.RECORD_NOT_FOUND
    if (code === '23514' || code === '22P02') return SALES_ANALYTICS_ERROR_CODES.INVALID_INPUT

    if (message.includes('not authenticated') || message.includes('jwt')) {
      return SALES_ANALYTICS_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('access denied') || message.includes('permission') || message.includes('row-level security')) {
      return SALES_ANALYTICS_ERROR_CODES.ACCESS_DENIED
    }
    if (message.includes('shop not found') || message.includes('no shop')) {
      return SALES_ANALYTICS_ERROR_CODES.SHOP_NOT_FOUND
    }
    if (message.includes('not found') || message.includes('no rows')) {
      return SALES_ANALYTICS_ERROR_CODES.RECORD_NOT_FOUND
    }
    if (message.includes('invalid filter') || message.includes('invalid filters')) {
      return SALES_ANALYTICS_ERROR_CODES.INVALID_FILTERS
    }
    if (message.includes('export') && message.includes('not available')) {
      return SALES_ANALYTICS_ERROR_CODES.EXPORT_UNAVAILABLE
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return SALES_ANALYTICS_ERROR_CODES.NETWORK
    }
    if (message.includes('database query failed') || message.includes('database')) {
      return SALES_ANALYTICS_ERROR_CODES.DATABASE
    }
    if (message.includes('required') || message.includes('invalid')) {
      return SALES_ANALYTICS_ERROR_CODES.INVALID_INPUT
    }
  }

  return SALES_ANALYTICS_ERROR_CODES.UNKNOWN
}

export function toFriendlySalesAnalyticsError(error: unknown, fallback?: string): string {
  if (error instanceof SalesAnalyticsError) return error.message

  const code = classifySalesAnalyticsError(error)

  if (code === SALES_ANALYTICS_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? SALES_ANALYTICS_ERROR_MESSAGES[SALES_ANALYTICS_ERROR_CODES.UNKNOWN]
  }

  return SALES_ANALYTICS_ERROR_MESSAGES[code]
}
