/**
 * Capture-quality checks for Human verification.
 *
 * The analyzers (web Human pass and the native WebView) only *measure* — face
 * count, face/frame brightness, head angle, and a glasses edge score. Every
 * decision lives here so web, iOS, and Android judge frames identically.
 *
 * Gender reads from a second face, a turned head, or a near-black frame are
 * noise, so those frames are kept out of the gender average instead of being
 * allowed to drag a real woman under the threshold.
 */

export type FaceQualityMetrics = {
  /** Faces at least `extraFaceMinRatio` as wide as the primary (largest) face. */
  faceCount: number
  /** Mean luma (0–255) inside the primary face box. */
  faceLuma: number | null
  /** Mean luma (0–255) of the whole frame. */
  frameLuma: number | null
  yawDeg: number | null
  pitchDeg: number | null
  /**
   * Share (0–1) of the nose-bridge patch crossed by one strong horizontal edge —
   * a glasses bridge. Bare skin there is smooth, so this stays near 0 without glasses.
   */
  glassesScore: number | null
}

export type FaceQualityIssue =
  | 'multiple_faces'
  | 'too_dark'
  | 'backlit'
  | 'turned'
  | 'too_bright'
  | 'glasses'

export const FACE_QUALITY = {
  /** A second face this wide relative to the primary counts as another person in view. */
  extraFaceMinRatio: 0.45,
  /** Face darker than this is too noisy for a gender read. */
  darkFaceLuma: 45,
  /** Background this much brighter than a dim face means a window/lamp behind the user. */
  backlitLumaGap: 60,
  backlitFaceMaxLuma: 95,
  brightFaceLuma: 220,
  maxYawDeg: 25,
  maxPitchDeg: 25,
  /** Calibrated on real photos: glasses 0.88–1.0, bare faces ≤ 0.29. */
  glassesScore: 0.5,
  /** An issue must show in this many recent frames before we act on it. */
  webWindow: 5,
  webMinHits: 3,
  nativeWindow: 3,
  nativeMinHits: 2,
  /** On failure, mention issues present in at least this share of face frames. */
  reportMinShare: 0.3,
  /** Below this female score a read is clearly male; capture tips will not change it. */
  clearMaleScore: 0.25,
  /** Tips-and-retry chances per open of the verification sheet before the real verdict. */
  maxQualityRetries: 2,
} as const

/** Highest-priority first: the first entry is the one coaching line we show. */
const ISSUE_PRIORITY: readonly FaceQualityIssue[] = [
  'multiple_faces',
  'too_dark',
  'backlit',
  'turned',
  'too_bright',
  'glasses',
]

/** Issues that make a frame's gender read unusable. Glasses and glare only lower confidence. */
const GENDER_BLOCKING: ReadonlySet<FaceQualityIssue> = new Set([
  'multiple_faces',
  'too_dark',
  'turned',
])

export const FACE_QUALITY_HINTS: Record<FaceQualityIssue, string> = {
  multiple_faces: 'Only one face should be in view — ask others to step away',
  too_dark: 'Too dark — face a window or turn on a light',
  backlit: 'Light is behind you — turn to face the light',
  turned: 'Look straight at the camera',
  too_bright: 'Too bright — move out of direct light',
  glasses: 'Glasses can lower accuracy — take them off if you can',
}

export const FACE_QUALITY_TIPS: Record<FaceQualityIssue, string> = {
  multiple_faces: 'Make sure only your face is in the camera view.',
  too_dark: 'Move to a brighter spot — face a window or a lamp.',
  backlit: 'Avoid windows or lamps behind you; face the light instead.',
  turned: 'Hold the phone at eye level and look straight at the camera.',
  too_bright: 'Step out of harsh direct light or glare.',
  glasses: 'Take off glasses (and hats or masks) for the check.',
}

export const FACE_QUALITY_LABELS: Record<FaceQualityIssue, string> = {
  multiple_faces: 'multiple faces',
  too_dark: 'low light',
  backlit: 'backlit',
  turned: 'head turned',
  too_bright: 'overexposed',
  glasses: 'glasses',
}

export function assessFaceQuality(metrics: FaceQualityMetrics): FaceQualityIssue[] {
  const issues = new Set<FaceQualityIssue>()
  const { faceLuma, frameLuma, yawDeg, pitchDeg, glassesScore } = metrics

  if (metrics.faceCount > 1) issues.add('multiple_faces')
  if (faceLuma != null) {
    if (faceLuma < FACE_QUALITY.darkFaceLuma) issues.add('too_dark')
    else if (
      frameLuma != null &&
      faceLuma <= FACE_QUALITY.backlitFaceMaxLuma &&
      frameLuma - faceLuma >= FACE_QUALITY.backlitLumaGap
    ) {
      issues.add('backlit')
    }
    if (faceLuma > FACE_QUALITY.brightFaceLuma) issues.add('too_bright')
  }
  if (
    (yawDeg != null && Math.abs(yawDeg) > FACE_QUALITY.maxYawDeg) ||
    (pitchDeg != null && Math.abs(pitchDeg) > FACE_QUALITY.maxPitchDeg)
  ) {
    issues.add('turned')
  }
  if (glassesScore != null && glassesScore >= FACE_QUALITY.glassesScore) issues.add('glasses')

  return ISSUE_PRIORITY.filter((issue) => issues.has(issue))
}

export function blocksGenderSample(issues: readonly FaceQualityIssue[]): boolean {
  return issues.some((issue) => GENDER_BLOCKING.has(issue))
}

/** Rolling window so one noisy frame (a false second face, a flicker) is ignored. */
export type FaceQualitySmoother = {
  history: FaceQualityIssue[][]
  window: number
  minHits: number
}

export function createFaceQualitySmoother(window: number, minHits: number): FaceQualitySmoother {
  return { history: [], window, minHits }
}

/** Push this frame's issues; returns the issues persistent enough to act on. */
export function smoothFaceQuality(
  smoother: FaceQualitySmoother,
  issues: readonly FaceQualityIssue[],
): FaceQualityIssue[] {
  smoother.history = [...smoother.history.slice(-(smoother.window - 1)), [...issues]]
  return ISSUE_PRIORITY.filter(
    (issue) =>
      smoother.history.filter((frame) => frame.includes(issue)).length >= smoother.minHits,
  )
}

export function faceQualityHint(issues: readonly FaceQualityIssue[]): string | null {
  return issues.length ? FACE_QUALITY_HINTS[issues[0]] : null
}

/** Per-run issue counts over frames where a face was in view. */
export type FaceQualityTally = { frames: number; counts: Partial<Record<FaceQualityIssue, number>> }

export function createFaceQualityTally(): FaceQualityTally {
  return { frames: 0, counts: {} }
}

export function recordFaceQuality(tally: FaceQualityTally, issues: readonly FaceQualityIssue[]) {
  tally.frames += 1
  for (const issue of issues) tally.counts[issue] = (tally.counts[issue] ?? 0) + 1
}

/** Issues common enough in this run to explain a weak read, highest priority first. */
export function reportedFaceQualityIssues(
  tally: FaceQualityTally,
  minShare: number = FACE_QUALITY.reportMinShare,
): FaceQualityIssue[] {
  if (tally.frames === 0) return []
  return ISSUE_PRIORITY.filter((issue) => (tally.counts[issue] ?? 0) / tally.frames >= minShare)
}

/**
 * A below-threshold read taken in poor conditions earns a retry with tips rather
 * than a final "not eligible" — unless the read was clearly male anyway.
 */
export function shouldRetryForQuality(
  femaleScore: number | null,
  issues: readonly FaceQualityIssue[],
): boolean {
  if (femaleScore == null || issues.length === 0) return false
  return femaleScore >= FACE_QUALITY.clearMaleScore
}

export function medianAge(samples: readonly { age?: number }[]): number | null {
  const ages = samples
    .map((sample) => sample.age)
    .filter((age): age is number => typeof age === 'number' && Number.isFinite(age))
    .sort((a, b) => a - b)
  if (ages.length === 0) return null
  const mid = Math.floor(ages.length / 2)
  return Math.round(ages.length % 2 ? ages[mid] : (ages[mid - 1] + ages[mid]) / 2)
}
