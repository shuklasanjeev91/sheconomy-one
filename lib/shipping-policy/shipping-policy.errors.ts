/**
 * Centralised shop shipping-policy error handling.
 */

export const SHIPPING_POLICY_ERROR_CODES = {
  NOT_AUTHENTICATED: 'shipping-policy/not-authenticated',
  SHOP_ACCESS_DENIED: 'shipping-policy/shop-access-denied',
  PROFILE_ACCESS_DENIED: 'shipping-policy/profile-access-denied',
  LISTING_ACCESS_DENIED: 'shipping-policy/listing-access-denied',
  MAPPING_ACCESS_DENIED: 'shipping-policy/mapping-access-denied',
  SHOP_MISMATCH: 'shipping-policy/shop-mismatch',
  MISSING_PROFILE_NAME: 'shipping-policy/missing-profile-name',
  INVALID_INPUT: 'shipping-policy/invalid-input',
  INVALID_RATE_TYPE: 'shipping-policy/invalid-rate-type',
  DUPLICATE: 'shipping-policy/duplicate',
  NOT_FOUND: 'shipping-policy/not-found',
  NETWORK: 'shipping-policy/network',
  DATABASE: 'shipping-policy/database',
  UNKNOWN: 'shipping-policy/unknown',
} as const

export type ShippingPolicyErrorCode =
  (typeof SHIPPING_POLICY_ERROR_CODES)[keyof typeof SHIPPING_POLICY_ERROR_CODES]

const LEGACY_ERROR_CODE_MAP: Record<string, ShippingPolicyErrorCode> = {
  NOT_AUTHENTICATED: SHIPPING_POLICY_ERROR_CODES.NOT_AUTHENTICATED,
  SHOP_ACCESS_DENIED: SHIPPING_POLICY_ERROR_CODES.SHOP_ACCESS_DENIED,
  PROFILE_ACCESS_DENIED: SHIPPING_POLICY_ERROR_CODES.PROFILE_ACCESS_DENIED,
  POLICY_ACCESS_DENIED: SHIPPING_POLICY_ERROR_CODES.PROFILE_ACCESS_DENIED,
  LISTING_ACCESS_DENIED: SHIPPING_POLICY_ERROR_CODES.LISTING_ACCESS_DENIED,
  MAPPING_ACCESS_DENIED: SHIPPING_POLICY_ERROR_CODES.MAPPING_ACCESS_DENIED,
  SHOP_MISMATCH: SHIPPING_POLICY_ERROR_CODES.SHOP_MISMATCH,
  MISSING_PROFILE_NAME: SHIPPING_POLICY_ERROR_CODES.MISSING_PROFILE_NAME,
  ALREADY_ASSIGNED: SHIPPING_POLICY_ERROR_CODES.DUPLICATE,
  DATABASE_ERROR: SHIPPING_POLICY_ERROR_CODES.DATABASE,
  UNEXPECTED_ERROR: SHIPPING_POLICY_ERROR_CODES.UNKNOWN,
}

export const SHIPPING_POLICY_ERROR_MESSAGES: Record<ShippingPolicyErrorCode, string> = {
  [SHIPPING_POLICY_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage shipping settings.',
  [SHIPPING_POLICY_ERROR_CODES.SHOP_ACCESS_DENIED]:
    'This shop was not found or you do not have permission to manage its shipping policies.',
  [SHIPPING_POLICY_ERROR_CODES.PROFILE_ACCESS_DENIED]:
    'This shipping policy was not found or you do not have permission to change it.',
  [SHIPPING_POLICY_ERROR_CODES.LISTING_ACCESS_DENIED]:
    'This listing was not found or you do not have permission to manage its shipping policy.',
  [SHIPPING_POLICY_ERROR_CODES.MAPPING_ACCESS_DENIED]:
    'That shipping policy is not assigned to this listing, or you do not have permission to remove it.',
  [SHIPPING_POLICY_ERROR_CODES.SHOP_MISMATCH]:
    'The listing and shipping policy must belong to the same shop.',
  [SHIPPING_POLICY_ERROR_CODES.MISSING_PROFILE_NAME]: 'Profile name is required.',
  [SHIPPING_POLICY_ERROR_CODES.INVALID_INPUT]:
    'Some shipping details look invalid. Please review the highlighted fields.',
  [SHIPPING_POLICY_ERROR_CODES.INVALID_RATE_TYPE]:
    "Shipping rate type must be 'fixed', 'variable', or 'free'.",
  [SHIPPING_POLICY_ERROR_CODES.DUPLICATE]: 'This shipping policy is already assigned to the listing.',
  [SHIPPING_POLICY_ERROR_CODES.NOT_FOUND]:
    'We could not find that shipping policy. It may have been removed.',
  [SHIPPING_POLICY_ERROR_CODES.NETWORK]: 'Network issue — check your connection and try again.',
  [SHIPPING_POLICY_ERROR_CODES.DATABASE]:
    'We could not save your shipping policy due to a database error. Please try again.',
  [SHIPPING_POLICY_ERROR_CODES.UNKNOWN]:
    'Something went wrong with shipping settings. Please try again shortly.',
}

export class ShippingPolicyError extends Error {
  readonly code: ShippingPolicyErrorCode

  constructor(code: ShippingPolicyErrorCode, message?: string) {
    super(message ?? SHIPPING_POLICY_ERROR_MESSAGES[code])
    this.name = 'ShippingPolicyError'
    this.code = code
  }
}

type SupabaseLikeError = {
  code?: string | null
  message?: string | null
  error_code?: string | null
}

function isSupabaseLikeError(value: unknown): value is SupabaseLikeError {
  return typeof value === 'object' && value !== null && ('message' in value || 'code' in value)
}

function mapLegacyErrorCode(value: unknown): ShippingPolicyErrorCode | null {
  if (!isSupabaseLikeError(value)) return null
  const legacy = value.error_code
  if (typeof legacy === 'string' && legacy in LEGACY_ERROR_CODE_MAP) {
    return LEGACY_ERROR_CODE_MAP[legacy]
  }
  return null
}

export function classifyShippingPolicyError(error: unknown): ShippingPolicyErrorCode {
  if (error instanceof ShippingPolicyError) return error.code

  const legacy = mapLegacyErrorCode(error)
  if (legacy) return legacy

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '23505') return SHIPPING_POLICY_ERROR_CODES.DUPLICATE
    if (code === '42501') return SHIPPING_POLICY_ERROR_CODES.PROFILE_ACCESS_DENIED
    if (code === 'PGRST116') return SHIPPING_POLICY_ERROR_CODES.NOT_FOUND
    if (code === '23514' || code === '22P02') return SHIPPING_POLICY_ERROR_CODES.INVALID_INPUT

    if (message.includes('not authenticated') || message.includes('jwt')) {
      return SHIPPING_POLICY_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('access denied') || message.includes('permission') || message.includes('row-level security')) {
      return SHIPPING_POLICY_ERROR_CODES.PROFILE_ACCESS_DENIED
    }
    if (message.includes('shop mismatch') || message.includes('same shop')) {
      return SHIPPING_POLICY_ERROR_CODES.SHOP_MISMATCH
    }
    if (message.includes('already assigned')) {
      return SHIPPING_POLICY_ERROR_CODES.DUPLICATE
    }
    if (message.includes('shipping_rate_type')) {
      return SHIPPING_POLICY_ERROR_CODES.INVALID_RATE_TYPE
    }
    if (message.includes('not found') || message.includes('no rows')) {
      return SHIPPING_POLICY_ERROR_CODES.NOT_FOUND
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return SHIPPING_POLICY_ERROR_CODES.NETWORK
    }
    if (message.includes('required') || message.includes('invalid')) {
      return SHIPPING_POLICY_ERROR_CODES.INVALID_INPUT
    }
  }

  return SHIPPING_POLICY_ERROR_CODES.UNKNOWN
}

export function toFriendlyShippingPolicyError(error: unknown, fallback?: string): string {
  if (error instanceof ShippingPolicyError) return error.message

  const code = classifyShippingPolicyError(error)

  if (code === SHIPPING_POLICY_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? SHIPPING_POLICY_ERROR_MESSAGES[SHIPPING_POLICY_ERROR_CODES.UNKNOWN]
  }

  return SHIPPING_POLICY_ERROR_MESSAGES[code]
}
