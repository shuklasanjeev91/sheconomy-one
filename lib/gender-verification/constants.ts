export const GENDER_VERIFICATION = {
  /** Natural blinks required for liveness (close → open cycles). */
  requiredBlinks: 3,
  /** Fallback EAR when adaptive baseline is not ready yet (legacy). */
  earBlinkThreshold: 0.2,
  earOpenThreshold: 0.26,
  /** Reject micro-flicker / sensor noise. */
  minClosedMs: 80,
  /** Reject intentional long squint / eyes held shut. */
  maxClosedMs: 900,
  /** Avoid counting the same blink twice. */
  minBlinkGapMs: 320,
  minLivenessScore: 0.7,
  /** Human anti-spoof / liveness model floors (photo rejection). */
  minLiveScore: 0.45,
  minRealScore: 0.45,
  minGenderConfidence: 0.55,
  sessionMinutes: 15,
  /** Native camera sample rate — must be fast enough to catch a natural blink. */
  nativeFrameIntervalMs: 140,
  faceApiModelBaseUrl: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model',
  humanModelBaseUrl: 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/',
} as const


/**
 * UX config for the app-wide verification prompt (the modal that opens on its
 * own when an authenticated member is not yet verified). Every timing/label
 * lives here so the host and modal contain **no magic numbers**.
 */
export const GENDER_VERIFICATION_PROMPT = {
  /**
   * Quiet window after the user dismisses the modal. We don't nag on every
   * screen — the prompt re-appears only after this cooldown, or immediately if
   * the member navigates to a gender-restricted route.
   */
  dismissCooldownMs: 10 * 60 * 1000,
  /** Cross-platform storage key holding the last dismissal timestamp (epoch ms). */
  dismissStorageKey: 'sheconomy:gender-verify:dismissed-at',
  /** Query param + value that opens the "access restricted" modal (e.g. `?gender=restricted`). */
  restrictedQueryParam: 'gender',
  restrictedQueryValue: 'restricted',
} as const

/** MediaPipe Face Mesh eye landmark indices. */
export const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144] as const
export const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380] as const

export type VerificationPhase =
  | 'idle'
  | 'loading'
  | 'camera'
  | 'position'
  | 'blink'
  | 'analyze'
  | 'success'
  | 'error'

export type GenderEstimate = {
  isFemale: boolean
  confidence: number
}

export type LivenessMetrics = {
  detectedBlinks: number
  livenessScore: number
  faceCentered: boolean
}

/** Live camera tracking feedback for the verify-gender UI. */
export type FaceTrackingStatus = {
  faceDetected: boolean
  faceCentered: boolean
  eyesClosed: boolean
  calibrated: boolean
  avgEar: number | null
  liveScore?: number
  realScore?: number
  facingCamera?: boolean
}

