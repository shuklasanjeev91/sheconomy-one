/**
 * Return policy constants — single source of truth for defaults, limits, and labels.
 */

export const RETURN_SHIPPING_PAID_BY = {
  BUYER: 'buyer',
  SELLER: 'seller',
} as const

export const RETURN_SHIPPING_PAID_BY_VALUES = [
  RETURN_SHIPPING_PAID_BY.BUYER,
  RETURN_SHIPPING_PAID_BY.SELLER,
] as const

export const RETURN_POLICY_VALIDATION = {
  POLICY_NAME: { MIN_LENGTH: 1, MAX_LENGTH: 100 },
  RETURN_WINDOW_DAYS: { MIN: 1, MAX: 365, DEFAULT: 30 },
  CONDITION_DESCRIPTION: { MAX_LENGTH: 500 },
  POLICY_DETAILS: { MAX_LENGTH: 1000 },
  /** Skip refetch when shop policies were loaded within this window (ms). */
  CACHE_TTL_MS: 30_000,
} as const

export const DEFAULT_RETURN_POLICY_VALUES = {
  IS_DEFAULT: true,
  RETURN_WINDOW_DAYS: RETURN_POLICY_VALIDATION.RETURN_WINDOW_DAYS.DEFAULT,
  ACCEPTS_RETURNS: true,
  ACCEPTS_EXCHANGES: true,
  ACCEPTS_REFUNDS: true,
  RETURN_SHIPPING_PAID_BY: RETURN_SHIPPING_PAID_BY.BUYER,
  CONDITION_DESCRIPTION: 'Items must be in original condition',
  POLICY_DETAILS: 'Standard return policy with 30-day window',
  IS_ACTIVE: true,
} as const

export const RETURN_POLICY_DISPLAY = {
  SERVICE_RETURNS: 'Returns',
  SERVICE_EXCHANGES: 'Exchanges',
  SERVICE_REFUNDS: 'Refunds',
  SERVICE_NONE: 'None',
  SHIPPING_BUYER: 'Buyer pays',
  SHIPPING_SELLER: 'Seller pays',
  DEFAULT_LABEL: 'Default',
  CUSTOM_LABEL: 'Custom',
  WINDOW_SUFFIX: 'days',
  FALLBACK_SHOP_NAME: 'Shop',
  FALLBACK_POLICY_NAME: 'Return policy',
} as const

export const RETURN_POLICY_SUCCESS_MESSAGES = {
  CREATED: 'Return policy created successfully.',
  UPDATED: 'Return policy updated successfully.',
  DELETED: 'Return policy deleted successfully.',
  ASSIGNED: 'Return policy assigned to listing successfully.',
  REMOVED: 'Return policy removed from listing successfully.',
} as const
