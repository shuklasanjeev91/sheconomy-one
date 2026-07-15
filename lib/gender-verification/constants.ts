export const GENDER_VERIFICATION = {
  requiredBlinks: 3,
  earBlinkThreshold: 0.21,
  earOpenThreshold: 0.25,
  minLivenessScore: 0.72,
  minGenderConfidence: 0.62,
  sessionMinutes: 15,
  faceApiModelBaseUrl: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model',
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
