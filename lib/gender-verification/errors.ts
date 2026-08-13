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
  /** Face read too unstable to judge — worth another attempt, unlike NOT_ELIGIBLE. */
  LOW_CONFIDENCE_RETRY: 'gender/low-confidence-retry',
  NOT_ELIGIBLE: 'gender/not-eligible',
  SESSION_FAILED: 'gender/session-failed',
  /** The attempt outlived its server session — a fresh run fixes it. */
  SESSION_STALE: 'gender/session-stale',
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
  [GENDER_ERROR_CODES.LOW_CONFIDENCE_RETRY]:
    'We couldn’t get a steady read of your face. Move somewhere brighter with even light, take off glasses or anything covering your face, hold the phone at eye level, then try again.',
  [GENDER_ERROR_CODES.NOT_ELIGIBLE]:
    'This community is built for women. Verification didn’t meet the required confidence, so full access can’t be unlocked.',
  [GENDER_ERROR_CODES.SESSION_FAILED]:
    'We couldn’t start a secure verification session. Please check your connection and try again.',
  [GENDER_ERROR_CODES.SESSION_STALE]:
    'That check took too long and expired. Tap Try again to run a fresh verification.',
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

/** Short on-camera coaching line — the callout holds the full explanation. */
export const GENDER_ERROR_INSTRUCTIONS: Record<GenderErrorCode, string> = {
  [GENDER_ERROR_CODES.IMAGE_TOO_LARGE]: 'Move a little farther from the camera',
  [GENDER_ERROR_CODES.CAMERA_DENIED]: 'Camera access is needed to continue',
  [GENDER_ERROR_CODES.CAMERA_UNAVAILABLE]: 'No camera available right now',
  [GENDER_ERROR_CODES.FACE_NOT_DETECTED]: 'We couldn’t see your face clearly',
  [GENDER_ERROR_CODES.LIVENESS_FAILED]: 'Liveness check didn’t finish — try again',
  [GENDER_ERROR_CODES.LOW_CONFIDENCE_RETRY]: 'Need a clearer read — brighter light helps',
  [GENDER_ERROR_CODES.NOT_ELIGIBLE]: 'Verification didn’t meet the required confidence',
  [GENDER_ERROR_CODES.SESSION_FAILED]: 'Couldn’t start a secure session',
  [GENDER_ERROR_CODES.SESSION_STALE]: 'That attempt expired — tap Try again',
  [GENDER_ERROR_CODES.RATE_LIMITED]: 'Too many attempts — wait a moment',
  [GENDER_ERROR_CODES.NETWORK]: 'Network issue — check your connection',
  [GENDER_ERROR_CODES.TIMEOUT]: 'That took too long — try again',
  [GENDER_ERROR_CODES.MODEL_LOAD_FAILED]: 'Couldn’t load verification models',
  [GENDER_ERROR_CODES.UNKNOWN]: 'Something went wrong — try again',
}

/** Soft failures that deserve one automatic retry; eligibility failures never auto-loop. */
export const GENDER_SOFT_RETRY_CODES: ReadonlySet<GenderErrorCode> = new Set([
  GENDER_ERROR_CODES.LOW_CONFIDENCE_RETRY,
  GENDER_ERROR_CODES.LIVENESS_FAILED,
  GENDER_ERROR_CODES.FACE_NOT_DETECTED,
  GENDER_ERROR_CODES.TIMEOUT,
  GENDER_ERROR_CODES.NETWORK,
  GENDER_ERROR_CODES.SESSION_STALE,
])

export function isSoftRetryableGenderError(error: unknown): boolean {
  return GENDER_SOFT_RETRY_CODES.has(classifyGenderError(error))
}

export function getGenderErrorInstruction(error: unknown): string {
  return GENDER_ERROR_INSTRUCTIONS[classifyGenderError(error)]
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

/** Postgres / PostgREST faults, which name our own tables and functions. */
function isDatabaseFailure(message: string): boolean {
  return (
    message.includes('violates') ||
    message.includes('constraint') ||
    message.includes('relation ') ||
    message.includes('schema cache') ||
    message.includes('sqlstate')
  )
}

function isStaleSessionMessage(message: string): boolean {
  return (
    message.includes('session is no longer active') ||
    message.includes('session not found') ||
    message.includes('session expired')
  )
}

/**
 * True when the server rejected a submission because its session was superseded,
 * missing, or expired — the caller can recover by starting a fresh session.
 */
export function isStaleGenderSessionError(error: unknown): boolean {
  return classifyGenderError(error) === GENDER_ERROR_CODES.SESSION_STALE
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
  // Must precede the face / confidence rules below — this copy mentions both.
  if (message.includes('steady read')) {
    return GENDER_ERROR_CODES.LOW_CONFIDENCE_RETRY
  }
  // Raw Postgres / PostgREST failures must surface verbatim. Their text carries
  // our table and function names, which used to be swallowed by the "session"
  // rule below and shown as a connection problem.
  if (isDatabaseFailure(message)) {
    return GENDER_ERROR_CODES.UNKNOWN
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
    message.includes('could not confirm a live face') ||
    message.includes('photo or screen') ||
    message.includes('anti-spoof')
  ) {
    return GENDER_ERROR_CODES.LIVENESS_FAILED
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
  if (isStaleSessionMessage(message)) {
    return GENDER_ERROR_CODES.SESSION_STALE
  }
  // Only the session-start copy — anything else mentioning a session is either
  // stale (above) or a server fault we would rather show as-is.
  if (
    message.includes('start verification session') ||
    message.includes('secure verification session')
  ) {
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
