export const GENDER_VERIFICATION = {
  requiredBlinks: 3,
  earBlinkThreshold: 0.21,
  earOpenThreshold: 0.25,
  minLivenessScore: 0.72,
  minGenderConfidence: 0.62,
  sessionMinutes: 15,
  faceApiModelBaseUrl: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model',
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
