/**
 * Pixel math behind `FaceQualityMetrics`. Kept free of DOM types so it can be
 * unit tested; the native WebView analyzer carries a line-for-line JS port in
 * `native-analyzer-html.ts` — change both together.
 */

/** Rec. 601 luma for each RGBA pixel. */
export function rgbaToLuma(rgba: ArrayLike<number>, pixelCount: number): Float32Array {
  const luma = new Float32Array(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    luma[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
  }
  return luma
}

export function meanOf(values: ArrayLike<number>): number {
  if (values.length === 0) return 0
  let sum = 0
  for (let i = 0; i < values.length; i++) sum += values[i]
  return sum / values.length
}

/**
 * Best single-row share of columns crossing a strong horizontal edge, compared
 * two rows apart. A glasses bridge draws one dark line across the whole patch;
 * skin, shadows, and the nose itself do not.
 */
export function horizontalEdgeCoverage(luma: ArrayLike<number>, size: number): number {
  const threshold = Math.max(10, meanOf(luma) * 0.12)
  let best = 0
  for (let row = 0; row < size - 2; row++) {
    let hits = 0
    for (let col = 0; col < size; col++) {
      if (Math.abs(luma[row * size + col] - luma[(row + 2) * size + col]) > threshold) hits++
    }
    best = Math.max(best, hits / size)
  }
  return best
}

type Point = { x: number; y: number }

/** Source-space rectangle over the nose bridge, between the inner eye corners. */
export function noseBridgeRect(innerLeft: Point, innerRight: Point, bridgeTop: Point) {
  const span = Math.abs(innerRight.x - innerLeft.x)
  return {
    x: Math.min(innerLeft.x, innerRight.x) + span * 0.25,
    y: bridgeTop.y - span * 0.15,
    width: span * 0.5,
    height: span * 0.6,
  }
}

/** MediaPipe mesh indices: inner eye corners and the bridge point between the eyes. */
export const GLASSES_MESH_POINTS = { innerLeft: 133, innerRight: 362, bridgeTop: 168 } as const

/** Side length of the square luma patches sampled for brightness and glasses. */
export const QUALITY_PATCH_SIZE = { luma: 32, bridge: 24 } as const

const RADIANS_TO_DEGREES = 180 / Math.PI

export function toDegrees(radians: number | null | undefined): number | null {
  return typeof radians === 'number' && Number.isFinite(radians)
    ? Math.round(radians * RADIANS_TO_DEGREES)
    : null
}
