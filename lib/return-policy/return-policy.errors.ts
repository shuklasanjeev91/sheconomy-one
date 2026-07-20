/**
 * Centralised return-policy error handling.
 *
 * Raw Supabase failures and legacy `error_code` strings are routed through
 * `toFriendlyReturnPolicyError` so toasts, banners, and error boundaries
 * always show actionable copy.
 */

export const RETURN_POLICY_ERROR_CODES = {
  NOT_AUTHENTICATED: 'return-policy/not-authenticated',
  SHOP_ACCESS_DENIED: 'return-policy/shop-access-denied',
  POLICY_ACCESS_DENIED: 'return-policy/policy-access-denied',
  LISTING_ACCESS_DENIED: 'return-policy/listing-access-denied',
  MAPPING_ACCESS_DENIED: 'return-policy/mapping-access-denied',
  SHOP_MISMATCH: 'return-policy/shop-mismatch',
  MISSING_POLICY_NAME: 'return-policy/missing-policy-name',
  INVALID_INPUT: 'return-policy/invalid-input',
  DUPLICATE: 'return-policy/duplicate',
  NOT_FOUND: 'return-policy/not-found',
  NETWORK: 'return-policy/network',
  DATABASE: 'return-policy/database',
  UNKNOWN: 'return-policy/unknown',
} as const

export type ReturnPolicyErrorCode =
  (typeof RETURN_POLICY_ERROR_CODES)[keyof typeof RETURN_POLICY_ERROR_CODES]

/** Legacy service `error_code` values from the old listing-profile-service. */
const LEGACY_ERROR_CODE_MAP: Record<string, ReturnPolicyErrorCode> = {
  NOT_AUTHENTICATED: RETURN_POLICY_ERROR_CODES.NOT_AUTHENTICATED,
  SHOP_ACCESS_DENIED: RETURN_POLICY_ERROR_CODES.SHOP_ACCESS_DENIED,
  POLICY_ACCESS_DENIED: RETURN_POLICY_ERROR_CODES.POLICY_ACCESS_DENIED,
  LISTING_ACCESS_DENIED: RETURN_POLICY_ERROR_CODES.LISTING_ACCESS_DENIED,
  MAPPING_ACCESS_DENIED: RETURN_POLICY_ERROR_CODES.MAPPING_ACCESS_DENIED,
  SHOP_MISMATCH: RETURN_POLICY_ERROR_CODES.SHOP_MISMATCH,
  MISSING_POLICY_NAME: RETURN_POLICY_ERROR_CODES.MISSING_POLICY_NAME,
  ALREADY_ASSIGNED: RETURN_POLICY_ERROR_CODES.DUPLICATE,
  DATABASE_ERROR: RETURN_POLICY_ERROR_CODES.DATABASE,
  UNEXPECTED_ERROR: RETURN_POLICY_ERROR_CODES.UNKNOWN,
}

export const RETURN_POLICY_ERROR_MESSAGES: Record<ReturnPolicyErrorCode, string> = {
  [RETURN_POLICY_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage return policies.',
  [RETURN_POLICY_ERROR_CODES.SHOP_ACCESS_DENIED]:
    'This shop was not found or you do not have permission to manage its return policies.',
  [RETURN_POLICY_ERROR_CODES.POLICY_ACCESS_DENIED]:
    'This return policy was not found or you do not have permission to change it.',
  [RETURN_POLICY_ERROR_CODES.LISTING_ACCESS_DENIED]:
    'This listing was not found or you do not have permission to manage its return policies.',
  [RETURN_POLICY_ERROR_CODES.MAPPING_ACCESS_DENIED]:
    'That return policy is not assigned to this listing, or you do not have permission to remove it.',
  [RETURN_POLICY_ERROR_CODES.SHOP_MISMATCH]:
    'The listing and return policy must belong to the same shop.',
  [RETURN_POLICY_ERROR_CODES.MISSING_POLICY_NAME]: 'Policy name is required.',
  [RETURN_POLICY_ERROR_CODES.INVALID_INPUT]:
    'Some return policy details look invalid. Please review the highlighted fields.',
  [RETURN_POLICY_ERROR_CODES.DUPLICATE]: 'This return policy is already assigned to the listing.',
  [RETURN_POLICY_ERROR_CODES.NOT_FOUND]: 'We could not find that return policy. It may have been removed.',
  [RETURN_POLICY_ERROR_CODES.NETWORK]: 'Network issue — check your connection and try again.',
  [RETURN_POLICY_ERROR_CODES.DATABASE]:
    'We could not save your return policy due to a database error. Please try again.',
  [RETURN_POLICY_ERROR_CODES.UNKNOWN]:
    'Something went wrong with return policies. Please try again shortly.',
}

export class ReturnPolicyError extends Error {
  readonly code: ReturnPolicyErrorCode

  constructor(code: ReturnPolicyErrorCode, message?: string) {
    super(message ?? RETURN_POLICY_ERROR_MESSAGES[code])
    this.name = 'ReturnPolicyError'
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

function mapLegacyErrorCode(value: unknown): ReturnPolicyErrorCode | null {
  if (!isSupabaseLikeError(value)) return null
  const legacy = value.error_code
  if (typeof legacy === 'string' && legacy in LEGACY_ERROR_CODE_MAP) {
    return LEGACY_ERROR_CODE_MAP[legacy]
  }
  return null
}

export function classifyReturnPolicyError(error: unknown): ReturnPolicyErrorCode {
  if (error instanceof ReturnPolicyError) return error.code

  const legacy = mapLegacyErrorCode(error)
  if (legacy) return legacy

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '23505') return RETURN_POLICY_ERROR_CODES.DUPLICATE
    if (code === '42501') return RETURN_POLICY_ERROR_CODES.POLICY_ACCESS_DENIED
    if (code === 'PGRST116') return RETURN_POLICY_ERROR_CODES.NOT_FOUND
    if (code === '23514' || code === '22P02') return RETURN_POLICY_ERROR_CODES.INVALID_INPUT

    if (message.includes('not authenticated') || message.includes('jwt')) {
      return RETURN_POLICY_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('access denied') || message.includes('permission') || message.includes('row-level security')) {
      return RETURN_POLICY_ERROR_CODES.POLICY_ACCESS_DENIED
    }
    if (message.includes('shop mismatch') || message.includes('same shop')) {
      return RETURN_POLICY_ERROR_CODES.SHOP_MISMATCH
    }
    if (message.includes('already assigned')) {
      return RETURN_POLICY_ERROR_CODES.DUPLICATE
    }
    if (message.includes('not found') || message.includes('no rows')) {
      return RETURN_POLICY_ERROR_CODES.NOT_FOUND
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return RETURN_POLICY_ERROR_CODES.NETWORK
    }
    if (message.includes('required') || message.includes('invalid')) {
      return RETURN_POLICY_ERROR_CODES.INVALID_INPUT
    }
  }

  return RETURN_POLICY_ERROR_CODES.UNKNOWN
}

export function toFriendlyReturnPolicyError(error: unknown, fallback?: string): string {
  if (error instanceof ReturnPolicyError) return error.message

  const code = classifyReturnPolicyError(error)

  if (code === RETURN_POLICY_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? RETURN_POLICY_ERROR_MESSAGES[RETURN_POLICY_ERROR_CODES.UNKNOWN]
  }

  return RETURN_POLICY_ERROR_MESSAGES[code]
}
