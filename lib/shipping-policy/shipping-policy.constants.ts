/**
 * Shop-level shipping (delivery profile) constants.
 */

export const SHIPPING_RATE_TYPE = {
  FIXED: 'fixed',
  VARIABLE: 'variable',
  FREE: 'free',
} as const

export const SHIPPING_RATE_TYPE_VALUES = [
  SHIPPING_RATE_TYPE.FIXED,
  SHIPPING_RATE_TYPE.VARIABLE,
  SHIPPING_RATE_TYPE.FREE,
] as const

export const SHIPPING_ZONE_TYPE = {
  DOMESTIC: 'domestic',
  INTERNATIONAL: 'international',
  SHOP: 'shop',
} as const

export const SHIPPING_ZONE_TYPE_VALUES = [
  SHIPPING_ZONE_TYPE.DOMESTIC,
  SHIPPING_ZONE_TYPE.INTERNATIONAL,
  SHIPPING_ZONE_TYPE.SHOP,
] as const

export const SHIPPING_POLICY_VALIDATION = {
  PROFILE_NAME: { MIN_LENGTH: 1, MAX_LENGTH: 100 },
  PROCESSING_TIME: { MIN: 1, MAX: 365 },
  PROCESSING_TIME_DEFAULT: { MIN: 1, MAX: 3 },
  FREE_SHIPPING_THRESHOLD: { MIN: 0 },
  FIXED_FEE: { MIN: 0 },
  ZONE_NAME: { MAX_LENGTH: 100 },
  ZONE_DESCRIPTION: { MAX_LENGTH: 500 },
  /** Skip refetch when shop policies were loaded within this window (ms). */
  CACHE_TTL_MS: 30_000,
} as const

export const DEFAULT_SHIPPING_POLICY_VALUES = {
  IS_DEFAULT: true,
  IS_ACTIVE: true,
  PROCESSING_TIME_MIN: SHIPPING_POLICY_VALIDATION.PROCESSING_TIME_DEFAULT.MIN,
  PROCESSING_TIME_MAX: SHIPPING_POLICY_VALIDATION.PROCESSING_TIME_DEFAULT.MAX,
  SHIPPING_RATE_TYPE: SHIPPING_RATE_TYPE.FIXED,
  FIXED_FEE: 0,
  FREE_SHIPPING_THRESHOLD: null,
  SHIPPING_ZONES: [] as const,
  DELIVERY_METADATA: {} as const,
} as const

export const SHIPPING_POLICY_DISPLAY = {
  DEFAULT_LABEL: 'Default',
  CUSTOM_LABEL: 'Custom',
  INACTIVE_LABEL: 'Inactive',
  FALLBACK_SHOP_NAME: 'Shop',
  FALLBACK_PROFILE_NAME: 'Shop Level Shipping',
  NO_FREE_SHIPPING: 'No free shipping threshold',
  FREE_SHIPPING_PREFIX: 'Free shipping on orders over',
  ZONES_SUFFIX: 'zones',
  PROCESSING_SUFFIX: 'days',
} as const

export const SHIPPING_POLICY_SUCCESS_MESSAGES = {
  CREATED: 'Shipping policy created successfully.',
  UPDATED: 'Shipping policy updated successfully.',
  DELETED: 'Shipping policy deleted successfully.',
  ASSIGNED: 'Shipping policy assigned to listing successfully.',
  REMOVED: 'Shipping policy removed from listing successfully.',
} as const

/** Preset processing windows used by the vendor form UI. */
export const SHIPPING_PROCESSING_PRESETS = [
  { value: '1-3', label: '1-3 Days', min: 1, max: 3 },
  { value: '3-7', label: '3-7 Days', min: 3, max: 7 },
  { value: '7-12', label: '7-12 Days', min: 7, max: 12 },
] as const

export const SHIPPING_CALCULATOR_DEFAULTS = {
  ESTIMATED_DAYS: 7,
  ZERO_AMOUNT: 0,
} as const
