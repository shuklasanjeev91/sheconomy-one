export const GENDER_VERIFICATION = {
  /** Natural blinks required for liveness (close → open cycles). */
  requiredBlinks: 2,
  /** Fallback EAR when adaptive baseline is not ready yet. */
  earBlinkThreshold: 0.2,
  earOpenThreshold: 0.26,
  /**
   * Minimum closed duration. Native samples are slower (~3–6 fps), so keep this
   * low enough that a single closed sample still counts on reopen.
   */
  minClosedMs: 50,
  /** Reject intentional long squint / eyes held shut. */
  maxClosedMs: 900,
  /** Avoid counting the same blink twice. */
  minBlinkGapMs: 280,
  /**
   * Client + server share this floor. Mirrored by
   * `complete_gender_verification_session` — keep migrations in sync.
   */
  minLivenessScore: 0.7,
  /** Human anti-spoof / liveness model floors (photo rejection). */
  minLiveScore: 0.4,
  minRealScore: 0.4,
  /**
   * Mean female probability required to pass, judged across many frames rather
   * than one. Mirrored by `complete_gender_verification_session` — keep this in
   * sync with the latest gender-verification migration.
   */
  minGenderConfidence: 0.6,
  /** Usable gender samples needed before we judge the run at all. */
  minGenderSamples: 4,
  /** Extra samples gathered in the one follow-up round after a borderline read. */
  extraGenderSamples: 5,
  /** A mean this far under the threshold earns another round instead of a rejection. */
  genderBorderlineBand: 0.08,
  /** Cap on the follow-up round so an unreadable face still fails promptly. */
  extraGenderSamplingMs: 4000,
  /** Every Nth native frame also runs the gender model (see the analyzer `both` mode). */
  nativeGenderSampleEvery: 2,
  sessionMinutes: 15,
  /**
   * Native capture cadence. takePictureAsync is slow; a short interval only
   * queues work behind processingRef — prefer fewer, lighter frames.
   */
  nativeFrameIntervalMs: 350,
  /** Wait after onCameraReady before takePicture — photo output dims need a beat after Allow. */
  nativeCameraSettleMs: 1200,
  /** Warm restart: camera already running, so settle can be much shorter. */
  nativeCameraResettleMs: 350,
  /** Open-eye EAR samples before blink thresholds adapt to this face/camera. */
  earCalibrationSamples: 6,
  /** One soft auto-retry for lighting / face / liveness failures (never eligibility). */
  softRetryDelayMs: 1400,
  /** Downscale side length before Human.detect in the native WebView. */
  nativeDetectMaxSide: 480,
  faceApiModelBaseUrl: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model',
  humanModelBaseUrl: 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/',
} as const


/**
 * UX config for the app-wide Human verification prompt.
 * The modal opens only on intent (Community / Chat / Create store), not after login.
 * Timings and query flags live here so the host/modal contain **no magic numbers**.
 */
export const GENDER_VERIFICATION_PROMPT = {
  /**
   * Quiet window after the user dismisses the modal (denied / skip). Used so we
   * don't re-open the denied modal immediately on the same navigation.
   */
  dismissCooldownMs: 10 * 60 * 1000,
  /** Cross-platform storage key holding the last dismissal timestamp (epoch ms). */
  dismissStorageKey: 'sheconomy:gender-verify:dismissed-at',
  /** Query param + value that opens the "access restricted" modal (e.g. `?gender=restricted`). */
  restrictedQueryParam: 'gender',
  restrictedQueryValue: 'restricted',
  /** Query param + value that opens Human verification directly (e.g. `?human=verify`). */
  verifyQueryParam: 'human',
  verifyQueryValue: 'verify',
  /** Optional return path after a successful Human verification (`?returnTo=/community`). */
  returnToQueryParam: 'returnTo',
  /** Survives SPA redirect / reload so an in-progress verify session stays open. */
  verificationFlowStorageKey: 'sheconomy:gender-verify:flow-open',
  /** Persisted return path after verify success (when query is cleaned). */
  returnToStorageKey: 'sheconomy:human-verify:return-to',
} as const

/** Shown in Human verification UI — respect + security framing. */
export const HUMAN_VERIFICATION_DISCLAIMER =
  'We respect all users. Human verification only confirms that you are a real person and that access to women-first spaces is limited to women — for community safety and security. Checks run on-device; we do not upload your video.'

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

