/**
 * Centralised company-page error handling.
 *
 * Every service failure funnels raw Supabase / network errors through
 * `toFriendlyCompanyPageError` so the UI (toasts, banners) always shows a
 * human, actionable message instead of a Postgres code.
 */

export const COMPANY_PAGE_ERROR_CODES = {
  NOT_AUTHENTICATED: 'company-page/not-authenticated',
  NOT_FOUND: 'company-page/not-found',
  PERMISSION_DENIED: 'company-page/permission-denied',
  SLUG_TAKEN: 'company-page/slug-taken',
  DUPLICATE: 'company-page/duplicate',
  INVALID_INPUT: 'company-page/invalid-input',
  NETWORK: 'company-page/network',
  UNKNOWN: 'company-page/unknown',
} as const

export type CompanyPageErrorCode =
  (typeof COMPANY_PAGE_ERROR_CODES)[keyof typeof COMPANY_PAGE_ERROR_CODES]

export const COMPANY_PAGE_ERROR_MESSAGES: Record<CompanyPageErrorCode, string> = {
  [COMPANY_PAGE_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage company pages.',
  [COMPANY_PAGE_ERROR_CODES.NOT_FOUND]:
    'We couldn’t find that company page. It may have been removed.',
  [COMPANY_PAGE_ERROR_CODES.PERMISSION_DENIED]:
    'You don’t have permission to do that. Only an admin or page manager can make this change.',
  [COMPANY_PAGE_ERROR_CODES.SLUG_TAKEN]:
    'A page with that slug already exists. Try a different slug.',
  [COMPANY_PAGE_ERROR_CODES.DUPLICATE]: 'That company page already exists.',
  [COMPANY_PAGE_ERROR_CODES.INVALID_INPUT]:
    'Some page details are invalid. Please review and try again.',
  [COMPANY_PAGE_ERROR_CODES.NETWORK]:
    'Network issue — please check your connection and try again.',
  [COMPANY_PAGE_ERROR_CODES.UNKNOWN]:
    'Something went wrong with the company page. Please try again shortly.',
}

export class CompanyPageError extends Error {
  readonly code: CompanyPageErrorCode

  constructor(code: CompanyPageErrorCode, message?: string) {
    super(message ?? COMPANY_PAGE_ERROR_MESSAGES[code])
    this.name = 'CompanyPageError'
    this.code = code
  }
}

export function createCompanyPageError(code: CompanyPageErrorCode, message?: string): CompanyPageError {
  return new CompanyPageError(code, message)
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

export function classifyCompanyPageError(error: unknown): CompanyPageErrorCode {
  if (error instanceof CompanyPageError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    if (code === '23505') {
      return message.includes('slug') || message.includes('page_slug')
        ? COMPANY_PAGE_ERROR_CODES.SLUG_TAKEN
        : COMPANY_PAGE_ERROR_CODES.DUPLICATE
    }
    if (code === '42501') return COMPANY_PAGE_ERROR_CODES.PERMISSION_DENIED
    if (code === 'PGRST116') return COMPANY_PAGE_ERROR_CODES.NOT_FOUND
    if (code === '23514' || code === '22P02') return COMPANY_PAGE_ERROR_CODES.INVALID_INPUT

    if (message.includes('not authenticated') || message.includes('jwt')) {
      return COMPANY_PAGE_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('permission') || message.includes('row-level security')) {
      return COMPANY_PAGE_ERROR_CODES.PERMISSION_DENIED
    }
    if (message.includes('no rows') || message.includes('not found')) {
      return COMPANY_PAGE_ERROR_CODES.NOT_FOUND
    }
    if (message.includes('slug') && message.includes('already')) {
      return COMPANY_PAGE_ERROR_CODES.SLUG_TAKEN
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return COMPANY_PAGE_ERROR_CODES.NETWORK
    }
  }

  return COMPANY_PAGE_ERROR_CODES.UNKNOWN
}

export function toFriendlyCompanyPageError(error: unknown, fallback?: string): string {
  if (error instanceof CompanyPageError) return error.message

  const code = classifyCompanyPageError(error)

  if (code === COMPANY_PAGE_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? COMPANY_PAGE_ERROR_MESSAGES[COMPANY_PAGE_ERROR_CODES.UNKNOWN]
  }

  return COMPANY_PAGE_ERROR_MESSAGES[code]
}
