/**
 * Smallest camera picture size whose longer side is at least `minSide`.
 * Sizes come from `CameraView.getAvailablePictureSizesAsync()`: `"WxH"` strings,
 * plus iOS presets like `"Photo"` / `"High"` that are skipped. Returns
 * `undefined` when nothing qualifies, so the camera keeps its default.
 */
export function pickAnalysisPictureSize(sizes: readonly string[], minSide: number): string | undefined {
  let best: { size: string; area: number } | undefined
  for (const size of sizes) {
    const match = /^(\d+)x(\d+)$/.exec(size)
    if (!match) continue
    const width = Number(match[1])
    const height = Number(match[2])
    if (Math.max(width, height) < minSide) continue
    const area = width * height
    if (!best || area < best.area) best = { size, area }
  }
  return best?.size
}
