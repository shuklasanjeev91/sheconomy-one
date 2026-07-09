type Point = { x: number; y: number }

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function eyeAspectRatio(points: Point[], indices: readonly number[]) {
  const [p1, p2, p3, p4, p5, p6] = indices.map((index) => points[index])
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 1

  const vertical = distance(p2, p6) + distance(p3, p5)
  const horizontal = distance(p1, p4) * 2
  if (horizontal <= 0) return 1
  return vertical / horizontal
}

export type BlinkTracker = {
  count: number
  eyesClosed: boolean
}

export function createBlinkTracker(): BlinkTracker {
  return { count: 0, eyesClosed: false }
}

export function updateBlinkTracker(
  tracker: BlinkTracker,
  leftEar: number,
  rightEar: number,
  blinkThreshold: number,
  openThreshold: number,
) {
  const avgEar = (leftEar + rightEar) / 2

  if (!tracker.eyesClosed && avgEar < blinkThreshold) {
    tracker.eyesClosed = true
    return tracker
  }

  if (tracker.eyesClosed && avgEar > openThreshold) {
    tracker.eyesClosed = false
    tracker.count += 1
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
  const centerX = (box.xMin + box.xMax) / 2
  const centerY = (box.yMin + box.yMax) / 2
  const faceWidth = box.xMax - box.xMin
  const faceHeight = box.yMax - box.yMin

  const centered =
    Math.abs(centerX - width / 2) < width * 0.14 &&
    Math.abs(centerY - height / 2) < height * 0.16

  const sized =
    faceWidth > width * 0.28 &&
    faceWidth < width * 0.72 &&
    faceHeight > height * 0.22 &&
    faceHeight < height * 0.78

  return centered && sized
}
