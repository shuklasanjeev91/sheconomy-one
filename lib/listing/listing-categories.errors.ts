/**
 * Centralised category error handling.
 *
 * Every category-related failure funnels raw Supabase / network errors through
 * `toFriendlyCategoryError` so the UI (toasts, banners, the
 * `CategoryErrorBoundary`) always shows a human, actionable message instead of
 * a Postgres code. Mirrors `listing.errors` / `shop.errors` to stay symmetric.
 */

/** Stable, translatable error keys for known category failure modes. */
export const CATEGORY_ERROR_CODES = {
  NOT_AUTHENTICATED: 'category/not-authenticated',
  NOT_FOUND: 'category/not-found',
  PERMISSION_DENIED: 'category/permission-denied',
  ACCESS_DENIED: 'category/access-denied',
  DUPLICATE: 'category/duplicate',
  SEO_NAME_TAKEN: 'category/seo-name-taken',
  INVALID_INPUT: 'category/invalid-input',
  SELF_REFERENCE: 'category/self-reference',
  CIRCULAR_REFERENCE: 'category/circular-reference',
  HAS_CHILDREN: 'category/has-children',
  HAS_ASSIGNMENTS: 'category/has-assignments',
  PARENT_NOT_FOUND: 'category/parent-not-found',
  MAX_DEPTH: 'category/max-depth',
  MAX_ASSIGNMENTS: 'category/max-assignments',
  NETWORK: 'category/network',
  UNKNOWN: 'category/unknown',
} as const

export type CategoryErrorCode = (typeof CATEGORY_ERROR_CODES)[keyof typeof CATEGORY_ERROR_CODES]

/** User-facing copy for each known code. */
export const CATEGORY_ERROR_MESSAGES: Record<CategoryErrorCode, string> = {
  [CATEGORY_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage categories.',
  [CATEGORY_ERROR_CODES.NOT_FOUND]:
    'We couldn’t find that category. It may have been moved or removed.',
  [CATEGORY_ERROR_CODES.PERMISSION_DENIED]:
    'You don’t have permission to do that. Only an admin can manage categories.',
  [CATEGORY_ERROR_CODES.ACCESS_DENIED]: 'Category not found or access denied.',
  [CATEGORY_ERROR_CODES.DUPLICATE]: 'A category like that already exists.',
  [CATEGORY_ERROR_CODES.SEO_NAME_TAKEN]:
    'That SEO name is already in use. Try a slightly different name.',
  [CATEGORY_ERROR_CODES.INVALID_INPUT]:
    'Some category details are invalid. Please review the form and try again.',
  [CATEGORY_ERROR_CODES.SELF_REFERENCE]: 'A category can’t be its own parent.',
  [CATEGORY_ERROR_CODES.CIRCULAR_REFERENCE]:
    'You can’t move a category into one of its own sub-categories.',
  [CATEGORY_ERROR_CODES.HAS_CHILDREN]:
    'This category still has sub-categories. Move or delete them first.',
  [CATEGORY_ERROR_CODES.HAS_ASSIGNMENTS]:
    'This category still has products assigned to it. Reassign them first.',
  [CATEGORY_ERROR_CODES.PARENT_NOT_FOUND]: 'The chosen parent category doesn’t exist.',
  [CATEGORY_ERROR_CODES.MAX_DEPTH]: 'You’ve reached the maximum category depth.',
  [CATEGORY_ERROR_CODES.MAX_ASSIGNMENTS]:
    'A listing can only be assigned to a limited number of categories.',
  [CATEGORY_ERROR_CODES.NETWORK]:
    'Network issue — please check your connection and try again.',
  [CATEGORY_ERROR_CODES.UNKNOWN]:
    'Something went wrong with this category. Please try again shortly.',
}

/** A category error that carries a stable code alongside the friendly message. */
export class CategoryError extends Error {
  readonly code: CategoryErrorCode

  constructor(code: CategoryErrorCode, message?: string) {
    super(message ?? CATEGORY_ERROR_MESSAGES[code])
    this.name = 'CategoryError'
    this.code = code
  }
}

export function createCategoryError(code: CategoryErrorCode, message?: string): CategoryError {
  return new CategoryError(code, message)
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
 * Map a raw Supabase error to a stable category error code using its Postgres
 * code first, then falling back to well-known message fragments.
 */
export function classifyCategoryError(error: unknown): CategoryErrorCode {
  if (error instanceof CategoryError) return error.code

  if (isSupabaseLikeError(error)) {
    const code = error.code ?? ''
    const message = (error.message ?? '').toLowerCase()

    // Postgres / PostgREST codes.
    if (code === '23505') {
      return message.includes('seo')
        ? CATEGORY_ERROR_CODES.SEO_NAME_TAKEN
        : CATEGORY_ERROR_CODES.DUPLICATE
    }
    if (code === '42501') return CATEGORY_ERROR_CODES.PERMISSION_DENIED
    if (code === 'PGRST116') return CATEGORY_ERROR_CODES.NOT_FOUND
    if (code === '23503') return CATEGORY_ERROR_CODES.PARENT_NOT_FOUND
    if (code === '23514' || code === '22P02') return CATEGORY_ERROR_CODES.INVALID_INPUT

    // Message-based fallbacks.
    if (message.includes('own parent') || message.includes('self_reference')) {
      return CATEGORY_ERROR_CODES.SELF_REFERENCE
    }
    if (message.includes('descendant') || message.includes('circular')) {
      return CATEGORY_ERROR_CODES.CIRCULAR_REFERENCE
    }
    if (message.includes('subcategor') || message.includes('has children')) {
      return CATEGORY_ERROR_CODES.HAS_CHILDREN
    }
    if (message.includes('assignment') || message.includes('product')) {
      return CATEGORY_ERROR_CODES.HAS_ASSIGNMENTS
    }
    if (message.includes('not authenticated') || message.includes('jwt')) {
      return CATEGORY_ERROR_CODES.NOT_AUTHENTICATED
    }
    if (message.includes('permission') || message.includes('row-level security')) {
      return CATEGORY_ERROR_CODES.PERMISSION_DENIED
    }
    if (message.includes('access denied')) return CATEGORY_ERROR_CODES.ACCESS_DENIED
    if (message.includes('no rows') || message.includes('not found')) {
      return CATEGORY_ERROR_CODES.NOT_FOUND
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return CATEGORY_ERROR_CODES.NETWORK
    }
  }

  return CATEGORY_ERROR_CODES.UNKNOWN
}

/**
 * Turn any thrown value / Supabase error into a friendly, user-facing message.
 * Prefers a caller-supplied context prefix when the underlying error is generic.
 */
export function toFriendlyCategoryError(error: unknown, fallback?: string): string {
  if (error instanceof CategoryError) return error.message

  const code = classifyCategoryError(error)

  if (code === CATEGORY_ERROR_CODES.UNKNOWN) {
    if (isSupabaseLikeError(error) && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error
    return fallback ?? CATEGORY_ERROR_MESSAGES[CATEGORY_ERROR_CODES.UNKNOWN]
  }

  return CATEGORY_ERROR_MESSAGES[code]
}
