/** Native builds use WebView-based face analysis — no TF.js in the RN bundle. */

export type DetectedFaceFrame = {
  keypoints: Array<{ x: number; y: number; z?: number }>
  box: { xMin: number; xMax: number; yMin: number; yMax: number }
}

export async function getFaceLandmarksDetector(): Promise<never> {
  throw new Error('Face landmarks detector is web-only. Use NativeFaceAnalyzer on native.')
}

export async function detectFaceFrame(
  _source: unknown,
): Promise<DetectedFaceFrame | null> {
  return null
}
