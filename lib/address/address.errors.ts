/**
 * Centralised address error handling.
 *
 * Raw Supabase / RPC failures are routed through `toFriendlyAddressError` so
 * toasts, banners, and `AddressErrorBoundary` always show actionable copy.
 */

export const ADDRESS_ERROR_CODES = {
  NOT_AUTHENTICATED: 'address/not-authenticated',
  NOT_FOUND: 'address/not-found',
  PERMISSION_DENIED: 'address/permission-denied',
  INVALID_INPUT: 'address/invalid-input',
  DUPLICATE: 'address/duplicate',
  NETWORK: 'address/network',
  UNKNOWN: 'address/unknown',
} as const

export type AddressErrorCode = (typeof ADDRESS_ERROR_CODES)[keyof typeof ADDRESS_ERROR_CODES]

export const ADDRESS_ERROR_MESSAGES: Record<AddressErrorCode, string> = {
  [ADDRESS_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage your addresses.',
  [ADDRESS_ERROR_CODES.NOT_FOUND]: 'We couldn’t find that address. It may have been removed.',
  [ADDRESS_ERROR_CODES.PERMISSION_DENIED]:
    'You don’t have permission to change this address. Only the owner or an admin can do that.',
  [ADDRESS_ERROR_CODES.INVALID_INPUT]:
    'Some address details look invalid. Please review the highlighted fields.',
  [ADDRESS_ERROR_CODES.DUPLICATE]: 'That address already exists.',
  [ADDRESS_ERROR_CODES.NETWORK]: 'Network issue — check your connection and try again.',
  [ADDRESS_ERROR_CODES.UNKNOWN]: 'Something went wrong with your address. Please try again shortly.',
}

export class AddressError extends Error {
  readonly code: AddressErrorCode

  constructor(code: AddressErrorCode, message?: string) {
    super(message ?? ADDRESS_ERROR_MESSAGES[code])
    this.name = 'AddressError'
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

export function classifyAddressError(error: unknown): AddressErrorCode {
  if (error instanceof AddressError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '23505') return ADDRESS_ERROR_CODES.DUPLICATE
    if (code === '42501') return ADDRESS_ERROR_CODES.PERMISSION_DENIED
    if (code === 'PGRST116') return ADDRESS_ERROR_CODES.NOT_FOUND
    if (code === '23514' || code === '22P02') return ADDRESS_ERROR_CODES.INVALID_INPUT

    if (message.includes('not authenticated') || message.includes('jwt')) {
      return ADDRESS_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('access denied') || message.includes('permission') || message.includes('row-level security')) {
      return ADDRESS_ERROR_CODES.PERMISSION_DENIED
    }
    if (message.includes('not found') || message.includes('no rows')) {
      return ADDRESS_ERROR_CODES.NOT_FOUND
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return ADDRESS_ERROR_CODES.NETWORK
    }
  }

  return ADDRESS_ERROR_CODES.UNKNOWN
}

export function toFriendlyAddressError(error: unknown, fallback?: string): string {
  if (error instanceof AddressError) return error.message

  const code = classifyAddressError(error)

  if (code === ADDRESS_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? ADDRESS_ERROR_MESSAGES[ADDRESS_ERROR_CODES.UNKNOWN]
  }

  return ADDRESS_ERROR_MESSAGES[code]
}
