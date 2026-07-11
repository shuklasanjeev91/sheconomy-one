/**
 * Centralised NSFW-classifier error handling.
 *
 * The browser classifier is fail-open — a failed analysis returns an
 * "approved" fallback rather than throwing — so these codes mostly describe
 * *infrastructure* problems (model download, timeouts) plus the one hard
 * failure the images pipeline surfaces to users: content that was rejected.
 *
 * Mirrors `lib/listing/listing.errors` so the modules stay symmetric, and is
 * scoped to the NSFW module only (as requested).
 */

/** Stable keys for known NSFW-classifier failure modes. */
export const NSFW_ERROR_CODES = {
  MODEL_LOAD_FAILED: 'nsfw/model-load-failed',
  ANALYSIS_TIMEOUT: 'nsfw/analysis-timeout',
  ANALYSIS_FAILED: 'nsfw/analysis-failed',
  CONTENT_REJECTED: 'nsfw/content-rejected',
  UNSUPPORTED_INPUT: 'nsfw/unsupported-input',
  UNKNOWN: 'nsfw/unknown',
} as const

export type NsfwErrorCode = (typeof NSFW_ERROR_CODES)[keyof typeof NSFW_ERROR_CODES]

/** User-facing copy for each known code. */
export const NSFW_ERROR_MESSAGES: Record<NsfwErrorCode, string> = {
  [NSFW_ERROR_CODES.MODEL_LOAD_FAILED]:
    'We couldn’t load the content-safety model. Please check your connection and try again.',
  [NSFW_ERROR_CODES.ANALYSIS_TIMEOUT]:
    'Checking your image took too long. Please try again — the first check can be slow while the model loads.',
  [NSFW_ERROR_CODES.ANALYSIS_FAILED]:
    'We couldn’t finish checking your image. Please try again in a moment.',
  [NSFW_ERROR_CODES.CONTENT_REJECTED]:
    'One or more images were flagged as inappropriate and can’t be used. Please choose different images.',
  [NSFW_ERROR_CODES.UNSUPPORTED_INPUT]:
    'That image format isn’t supported for the safety check. Use a JPEG, PNG, WebP, or GIF file.',
  [NSFW_ERROR_CODES.UNKNOWN]:
    'Something went wrong while checking your image. Please try again shortly.',
}

/** An NSFW error that carries a stable code alongside the friendly message. */
export class NsfwError extends Error {
  readonly code: NsfwErrorCode

  constructor(code: NsfwErrorCode, message?: string) {
    super(message ?? NSFW_ERROR_MESSAGES[code])
    this.name = 'NsfwError'
    this.code = code
  }
}

export function createNsfwError(code: NsfwErrorCode, message?: string): NsfwError {
  return new NsfwError(code, message)
}

function getMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '')
  }
  return ''
}

/**
 * Map a thrown value / classifier error to a stable NSFW error code using
 * well-known message fragments produced by `nsfw-classifier`.
 */
export function classifyNsfwError(error: unknown): NsfwErrorCode {
  if (error instanceof NsfwError) return error.code

  const message = getMessage(error).toLowerCase()

  if (message.includes('rejected') || message.includes('nsfw') || message.includes('inappropriate')) {
    return NSFW_ERROR_CODES.CONTENT_REJECTED
  }
  if (message.includes('timed out') || message.includes('timeout')) {
    return NSFW_ERROR_CODES.ANALYSIS_TIMEOUT
  }
  if (message.includes('model loading failed') || message.includes('failed to load')) {
    return NSFW_ERROR_CODES.MODEL_LOAD_FAILED
  }
  if (message.includes('unsupported image input') || message.includes('not an image')) {
    return NSFW_ERROR_CODES.UNSUPPORTED_INPUT
  }
  if (message.includes('analysis failed') || message.includes('prediction')) {
    return NSFW_ERROR_CODES.ANALYSIS_FAILED
  }

  return NSFW_ERROR_CODES.UNKNOWN
}

/** Turn any thrown value / classifier error into a friendly, user-facing message. */
export function toFriendlyNsfwError(error: unknown, fallback?: string): string {
  if (error instanceof NsfwError) return error.message

  const code = classifyNsfwError(error)

  if (code === NSFW_ERROR_CODES.UNKNOWN) {
    const message = getMessage(error)
    if (message.trim()) return message
    return fallback ?? NSFW_ERROR_MESSAGES[NSFW_ERROR_CODES.UNKNOWN]
  }

  return NSFW_ERROR_MESSAGES[code]
}
