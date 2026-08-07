/**
 * Centralised gender-verification error handling.
 *
 * The liveness + gender check runs mostly on-device (MediaPipe blink tracking
 * and a bundled face model), so most failures are camera or environment
 * problems rather than server errors. The one server-shaped failure we must
 * translate carefully is a 413 "payload / face image too large" - historically
 * surfaced by the Face++ backend when the face fills too much of the frame. For
 * that we tell the user to step back from the camera.
 *
 * Mirrors `lib/nsfwjs/nsfw.errors` so the safety modules stay symmetric, and is
 * scoped to the gender-verification module only.
 */

/** Stable keys for known gender-verification failure modes. */
export const GENDER_ERROR_CODES = {
  /** Face too close / image too large (HTTP 413 or Face++ "too large"). */
  IMAGE_TOO_LARGE: 'gender/image-too-large',
  CAMERA_DENIED: 'gender/camera-denied',
  CAMERA_UNAVAILABLE: 'gender/camera-unavailable',
  FACE_NOT_DETECTED: 'gender/face-not-detected',
  LIVENESS_FAILED: 'gender/liveness-failed',
  NOT_ELIGIBLE: 'gender/not-eligible',
  SESSION_FAILED: 'gender/session-failed',
  RATE_LIMITED: 'gender/rate-limited',
  NETWORK: 'gender/network',
  TIMEOUT: 'gender/timeout',
  MODEL_LOAD_FAILED: 'gender/model-load-failed',
  UNKNOWN: 'gender/unknown',
} as const

export type GenderErrorCode = (typeof GENDER_ERROR_CODES)[keyof typeof GENDER_ERROR_CODES]

/** User-facing copy for each known code. */
export const GENDER_ERROR_MESSAGES: Record<GenderErrorCode, string> = {
  [GENDER_ERROR_CODES.IMAGE_TOO_LARGE]:
    'Your face is too close to the camera. Please move back a little so your whole face fits inside the oval, then try again.',
  [GENDER_ERROR_CODES.CAMERA_DENIED]:
    'Camera access was blocked. Go to Settings → SHEconomy → Camera, turn it on, then try again.',
  [GENDER_ERROR_CODES.CAMERA_UNAVAILABLE]:
    'We couldn’t find an available camera. Make sure no other app is using it, then try again.',
  [GENDER_ERROR_CODES.FACE_NOT_DETECTED]:
    'We couldn’t see your face clearly. Find good lighting, hold the camera steady, and center your face in the oval.',
  [GENDER_ERROR_CODES.LIVENESS_FAILED]:
    'The liveness check didn’t complete. Hold still, then blink naturally when prompted and try again.',
  [GENDER_ERROR_CODES.NOT_ELIGIBLE]:
    'This community is built for women. Verification didn’t meet the required confidence, so full access can’t be unlocked.',
  [GENDER_ERROR_CODES.SESSION_FAILED]:
    'We couldn’t start a secure verification session. Please check your connection and try again.',
  [GENDER_ERROR_CODES.RATE_LIMITED]:
    'Too many attempts in a short time. Please wait a moment and try again.',
  [GENDER_ERROR_CODES.NETWORK]:
    'Network error during verification. Please check your connection and try again.',
  [GENDER_ERROR_CODES.TIMEOUT]: 'Verification timed out. Please try again.',
  [GENDER_ERROR_CODES.MODEL_LOAD_FAILED]:
    'We couldn’t load the verification model. Please check your connection and try again.',
  [GENDER_ERROR_CODES.UNKNOWN]:
    'Something went wrong during verification. Please try again in a moment.',
}

/** A gender-verification error that carries a stable code alongside its message. */
export class GenderVerificationError extends Error {
  readonly code: GenderErrorCode

  constructor(code: GenderErrorCode, message?: string) {
    super(message ?? GENDER_ERROR_MESSAGES[code])
    this.name = 'GenderVerificationError'
    this.code = code
  }
}

export function createGenderVerificationError(
  code: GenderErrorCode,
  message?: string,
): GenderVerificationError {
  return new GenderVerificationError(code, message)
}

function getMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '')
  }
  return ''
}

/** Pull an HTTP-ish status code off a thrown value, if present. */
function getStatus(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const candidate = error as { status?: unknown; statusCode?: unknown }
    const raw = candidate.status ?? candidate.statusCode
    if (typeof raw === 'number') return raw
    if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw)
  }
  return null
}

/**
 * Map a thrown value to a stable gender-verification error code using the HTTP
 * status (when available) and well-known message fragments.
 */
export function classifyGenderError(error: unknown): GenderErrorCode {
  if (error instanceof GenderVerificationError) return error.code

  const status = getStatus(error)
  const message = getMessage(error).toLowerCase()

  // 413 / "face image too large" → ask the user to step back from the camera.
  if (
    status === 413 ||
    message.includes('413') ||
    message.includes('too large') ||
    message.includes('payload too large') ||
    message.includes('request entity too large') ||
    message.includes('face_image_too_large')
  ) {
    return GENDER_ERROR_CODES.IMAGE_TOO_LARGE
  }
  if (
    message.includes('permission') ||
    message.includes('denied') ||
    message.includes('notallowederror')
  ) {
    return GENDER_ERROR_CODES.CAMERA_DENIED
  }
  if (
    message.includes('notfounderror') ||
    message.includes('no camera') ||
    message.includes('device not available') ||
    message.includes('overconstrained')
  ) {
    return GENDER_ERROR_CODES.CAMERA_UNAVAILABLE
  }
  if (
    message.includes('could not analyze') ||
    message.includes('face') && message.includes('not')
  ) {
    return GENDER_ERROR_CODES.FACE_NOT_DETECTED
  }
  if (message.includes('liveness') || message.includes('blink') || message.includes('interrupted')) {
    return GENDER_ERROR_CODES.LIVENESS_FAILED
  }
  if (message.includes('women') || message.includes('confidence')) {
    return GENDER_ERROR_CODES.NOT_ELIGIBLE
  }
  if (message.includes('rate limit') || status === 429) {
    return GENDER_ERROR_CODES.RATE_LIMITED
  }
  if (message.includes('network') || message.includes('failed to fetch')) {
    return GENDER_ERROR_CODES.NETWORK
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return GENDER_ERROR_CODES.TIMEOUT
  }
  if (message.includes('model') && (message.includes('load') || message.includes('download'))) {
    return GENDER_ERROR_CODES.MODEL_LOAD_FAILED
  }
  if (message.includes('session')) {
    return GENDER_ERROR_CODES.SESSION_FAILED
  }

  return GENDER_ERROR_CODES.UNKNOWN
}

/** Turn any thrown value into a friendly, user-facing verification message. */
export function toFriendlyGenderError(error: unknown, fallback?: string): string {
  if (error instanceof GenderVerificationError) return error.message

  const code = classifyGenderError(error)

  if (code === GENDER_ERROR_CODES.UNKNOWN) {
    const message = getMessage(error)
    if (message.trim()) return message
    return fallback ?? GENDER_ERROR_MESSAGES[GENDER_ERROR_CODES.UNKNOWN]
  }

  return GENDER_ERROR_MESSAGES[code]
}
