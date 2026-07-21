/**
 * Centralised community-group error handling for admin (and reusable) UIs.
 */

export const GROUP_ERROR_CODES = {
  NOT_AUTHENTICATED: 'group/not-authenticated',
  NOT_FOUND: 'group/not-found',
  PERMISSION_DENIED: 'group/permission-denied',
  NAME_TAKEN: 'group/name-taken',
  DUPLICATE: 'group/duplicate',
  INVALID_INPUT: 'group/invalid-input',
  NETWORK: 'group/network',
  UNKNOWN: 'group/unknown',
} as const

export type GroupErrorCode = (typeof GROUP_ERROR_CODES)[keyof typeof GROUP_ERROR_CODES]

export const GROUP_ERROR_MESSAGES: Record<GroupErrorCode, string> = {
  [GROUP_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage groups.',
  [GROUP_ERROR_CODES.NOT_FOUND]: 'We couldn’t find that group. It may have been removed.',
  [GROUP_ERROR_CODES.PERMISSION_DENIED]:
    'You don’t have permission to do that. Only an admin or group admin can make this change.',
  [GROUP_ERROR_CODES.NAME_TAKEN]: 'A group with that name already exists. Try a different name.',
  [GROUP_ERROR_CODES.DUPLICATE]: 'That group already exists.',
  [GROUP_ERROR_CODES.INVALID_INPUT]: 'Some group details are invalid. Please review and try again.',
  [GROUP_ERROR_CODES.NETWORK]: 'Network issue — please check your connection and try again.',
  [GROUP_ERROR_CODES.UNKNOWN]: 'Something went wrong with the group. Please try again shortly.',
}

export class GroupError extends Error {
  readonly code: GroupErrorCode

  constructor(code: GroupErrorCode, message?: string) {
    super(message ?? GROUP_ERROR_MESSAGES[code])
    this.name = 'GroupError'
    this.code = code
  }
}

export function createGroupError(code: GroupErrorCode, message?: string): GroupError {
  return new GroupError(code, message)
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

export function classifyGroupError(error: unknown): GroupErrorCode {
  if (error instanceof GroupError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '23505') {
      return message.includes('name') ? GROUP_ERROR_CODES.NAME_TAKEN : GROUP_ERROR_CODES.DUPLICATE
    }
    if (code === '42501') return GROUP_ERROR_CODES.PERMISSION_DENIED
    if (code === 'PGRST116') return GROUP_ERROR_CODES.NOT_FOUND
    if (code === '23514' || code === '22P02') return GROUP_ERROR_CODES.INVALID_INPUT

    if (message.includes('not authenticated') || message.includes('jwt')) {
      return GROUP_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('permission') || message.includes('row-level security')) {
      return GROUP_ERROR_CODES.PERMISSION_DENIED
    }
    if (message.includes('no rows') || message.includes('not found')) {
      return GROUP_ERROR_CODES.NOT_FOUND
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return GROUP_ERROR_CODES.NETWORK
    }
  }

  return GROUP_ERROR_CODES.UNKNOWN
}

export function toFriendlyGroupError(error: unknown, fallback?: string): string {
  if (error instanceof GroupError) return error.message

  const code = classifyGroupError(error)

  if (code === GROUP_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? GROUP_ERROR_MESSAGES[GROUP_ERROR_CODES.UNKNOWN]
  }

  return GROUP_ERROR_MESSAGES[code]
}
