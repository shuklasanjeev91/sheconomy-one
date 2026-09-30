type Point = { x: number; y: number }

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Eye Aspect Ratio from 6 landmark points (p1…p6 around one eye). */
export function eyeAspectRatio(points: Point[], indices: readonly number[]) {
  const [p1, p2, p3, p4, p5, p6] = indices.map((index) => points[index])
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 1

  const vertical = distance(p2, p6) + distance(p3, p5)
  const horizontal = distance(p1, p4) * 2
  if (horizontal <= 0) return 1
  return vertical / horizontal
}

/** EAR from an ordered 6-point eye contour (no mesh index lookup). */
export function eyeAspectRatioFromContour(points: Point[]) {
  if (points.length < 6) return 1
  return eyeAspectRatio(points, [0, 1, 2, 3, 4, 5])
}

/**
 * Natural-blink liveness tracker.
 *
 * Counts a blink only when eyes close briefly then reopen — not a held squint,
 * not EAR noise, and not rapid double-counts from the same blink.
 */
export type BlinkTracker = {
  count: number
  eyesClosed: boolean
  closedAt: number | null
  lastBlinkAt: number | null
  /** Eyes stayed shut past maxClosedMs; wait for them to open before re-arming. */
  heldClosed?: boolean
}

export type BlinkTrackerOptions = {
  blinkThreshold: number
  openThreshold: number
  minClosedMs: number
  maxClosedMs: number
  minBlinkGapMs: number
  now?: number
}

/**
 * Learns this face's open-eye EAR. Open-eye EAR varies a lot between people
 * (eye shape, lashes, glasses, camera angle): values of 0.15–0.35 are all
 * normal, so any absolute band or floor leaves some faces unable to blink.
 */
export type EarCalibrator = {
  samples: number[]
  baseline: number | null
}

const EAR_SANE_MIN = 0.05
const EAR_SANE_MAX = 0.6
const EAR_WINDOW = 30
/** Upper percentile of recent reads, so blink frames don't drag the baseline down. */
const EAR_BASELINE_PERCENTILE = 0.7
/** A closed-eye read sits ~45–55% of open; partial blinks land around 65–75%. */
export const BLINK_CLOSED_RATIO = 0.78
export const BLINK_OPEN_RATIO = 0.9

export function createEarCalibrator(): EarCalibrator {
  return { samples: [], baseline: null }
}

export function updateEarCalibrator(
  calibrator: EarCalibrator,
  avgEar: number,
  sampleTarget = 6,
): EarCalibrator {
  if (!(avgEar > EAR_SANE_MIN && avgEar < EAR_SANE_MAX)) return calibrator
  // Keep blink frames out of the window once we know what "open" looks like.
  if (calibrator.baseline != null && avgEar < calibrator.baseline * BLINK_CLOSED_RATIO) {
    return calibrator
  }
  calibrator.samples = [...calibrator.samples.slice(-(EAR_WINDOW - 1)), avgEar]
  if (calibrator.samples.length < sampleTarget) return calibrator

  const sorted = [...calibrator.samples].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * EAR_BASELINE_PERCENTILE))
  calibrator.baseline = sorted[index] ?? null
  return calibrator
}

export function thresholdsFromBaseline(
  baseline: number | null,
  fallbackBlink: number,
  fallbackOpen: number,
): { blinkThreshold: number; openThreshold: number; calibrated: boolean } {
  if (baseline == null || baseline <= 0) {
    return {
      blinkThreshold: fallbackBlink,
      openThreshold: fallbackOpen,
      calibrated: false,
    }
  }
  return {
    blinkThreshold: baseline * BLINK_CLOSED_RATIO,
    openThreshold: baseline * BLINK_OPEN_RATIO,
    calibrated: true,
  }
}

export function createBlinkTracker(): BlinkTracker {
  return {
    count: 0,
    eyesClosed: false,
    closedAt: null,
    lastBlinkAt: null,
  }
}

export function updateBlinkTracker(
  tracker: BlinkTracker,
  leftEar: number,
  rightEar: number,
  blinkThresholdOrOptions: number | BlinkTrackerOptions,
  openThreshold?: number,
) {
  const options: BlinkTrackerOptions =
    typeof blinkThresholdOrOptions === 'number'
      ? {
          blinkThreshold: blinkThresholdOrOptions,
          openThreshold: openThreshold ?? blinkThresholdOrOptions + 0.04,
          minClosedMs: 60,
          maxClosedMs: 1000,
          minBlinkGapMs: 280,
        }
      : blinkThresholdOrOptions

  const now = options.now ?? Date.now()
  const avgEar = (leftEar + rightEar) / 2

  if (tracker.heldClosed) {
    if (avgEar > options.openThreshold) tracker.heldClosed = false
    return tracker
  }

  if (!tracker.eyesClosed && avgEar < options.blinkThreshold) {
    tracker.eyesClosed = true
    tracker.closedAt = now
    return tracker
  }

  if (tracker.eyesClosed) {
    const closedFor = tracker.closedAt != null ? now - tracker.closedAt : 0

    if (avgEar < options.blinkThreshold && closedFor > options.maxClosedMs) {
      tracker.eyesClosed = false
      tracker.closedAt = null
      tracker.heldClosed = true
      return tracker
    }

    if (avgEar > options.openThreshold) {
      const naturalDuration =
        closedFor >= options.minClosedMs && closedFor <= options.maxClosedMs
      const gapOk =
        tracker.lastBlinkAt == null || now - tracker.lastBlinkAt >= options.minBlinkGapMs

      if (naturalDuration && gapOk) {
        tracker.count += 1
        tracker.lastBlinkAt = now
      }

      tracker.eyesClosed = false
      tracker.closedAt = null
    }
  }

  return tracker
}

export type BlinkLivenessStep = {
  eyesClosed: boolean
  calibrated: boolean
  count: number
}

/**
 * One frame of blink liveness, shared by web and native. Blinks only count
 * once this face's open-eye baseline is known — absolute fallbacks read some
 * open eyes as "closed" forever, so the counter never moves.
 */
export function stepBlinkLiveness(
  tracker: BlinkTracker,
  calibrator: EarCalibrator,
  leftEar: number,
  rightEar: number,
  options: {
    calibrationSamples: number
    fallbackBlink: number
    fallbackOpen: number
    minClosedMs: number
    maxClosedMs: number
    minBlinkGapMs: number
    now?: number
  },
): BlinkLivenessStep {
  const avgEar = (leftEar + rightEar) / 2
  updateEarCalibrator(calibrator, avgEar, options.calibrationSamples)
  const thresholds = thresholdsFromBaseline(
    calibrator.baseline,
    options.fallbackBlink,
    options.fallbackOpen,
  )
  if (!thresholds.calibrated) {
    return { eyesClosed: false, calibrated: false, count: tracker.count }
  }
  updateBlinkTracker(tracker, leftEar, rightEar, {
    blinkThreshold: thresholds.blinkThreshold,
    openThreshold: thresholds.openThreshold,
    minClosedMs: options.minClosedMs,
    maxClosedMs: options.maxClosedMs,
    minBlinkGapMs: options.minBlinkGapMs,
    now: options.now,
  })
  return {
    eyesClosed: avgEar < thresholds.blinkThreshold,
    calibrated: true,
    count: tracker.count,
  }
}

export function computeLivenessScore(input: {
  detectedBlinks: number
  requiredBlinks: number
  faceCentered: boolean
  stableFrames: number
  minStableFrames: number
}) {
  const blinkScore = Math.min(1, input.detectedBlinks / Math.max(1, input.requiredBlinks))
  const centerScore = input.faceCentered ? 1 : 0.35
  const stabilityScore = Math.min(1, input.stableFrames / Math.max(1, input.minStableFrames))
  return Number((blinkScore * 0.55 + centerScore * 0.25 + stabilityScore * 0.2).toFixed(3))
}

export function isFaceCentered(
  box: { xMin: number; xMax: number; yMin: number; yMax: number },
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0) return false

  const centerX = (box.xMin + box.xMax) / 2
  const centerY = (box.yMin + box.yMax) / 2
  const faceWidth = box.xMax - box.xMin
  const faceHeight = box.yMax - box.yMin

  const centered =
    Math.abs(centerX - width / 2) < width * 0.32 &&
    Math.abs(centerY - height / 2) < height * 0.34

  const sized =
    faceWidth > width * 0.14 &&
    faceWidth < width * 0.94 &&
    faceHeight > height * 0.12 &&
    faceHeight < height * 0.94

  return centered && sized
}
