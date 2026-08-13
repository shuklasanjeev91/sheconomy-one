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
}

export type BlinkTrackerOptions = {
  blinkThreshold: number
  openThreshold: number
  minClosedMs: number
  maxClosedMs: number
  minBlinkGapMs: number
  now?: number
}

/** Calibrates open-eye EAR per user/camera so absolute thresholds aren't brittle. */
export type EarCalibrator = {
  samples: number[]
  baseline: number | null
}

export function createEarCalibrator(): EarCalibrator {
  return { samples: [], baseline: null }
}

export function updateEarCalibrator(
  calibrator: EarCalibrator,
  avgEar: number,
  sampleTarget = 18,
): EarCalibrator {
  if (calibrator.baseline != null) return calibrator
  // Only learn from clearly open eyes.
  if (avgEar < 0.17 || avgEar > 0.45) return calibrator
  calibrator.samples.push(avgEar)
  if (calibrator.samples.length < sampleTarget) return calibrator

  const sorted = [...calibrator.samples].sort((a, b) => a - b)
  const trim = Math.floor(sorted.length * 0.15)
  const mid = sorted.slice(trim, sorted.length - trim || sorted.length)
  const sum = mid.reduce((acc, value) => acc + value, 0)
  calibrator.baseline = sum / Math.max(1, mid.length)
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
    // Natural blinks typically drop EAR ~25–40% below open baseline.
    blinkThreshold: Math.max(0.12, baseline * 0.74),
    openThreshold: Math.max(0.16, baseline * 0.9),
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
      return tracker
    }

    if (avgEar > options.openThreshold) {
      const longEnough = closedFor >= options.minClosedMs
      const gapOk =
        tracker.lastBlinkAt == null || now - tracker.lastBlinkAt >= options.minBlinkGapMs

      if (longEnough && gapOk) {
        tracker.count += 1
        tracker.lastBlinkAt = now
      }

      tracker.eyesClosed = false
      tracker.closedAt = null
    }
  }

  return tracker
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
