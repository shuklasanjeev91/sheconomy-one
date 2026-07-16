/**
 * Native stub — NSFW classification runs on web only (see nsfw-classifier.web.ts).
 * Keeps @tensorflow/* out of the native Vite/oxc bundle.
 */

export type NsfwImageInput = string | Blob | File

export type NsfwAnalysisResult = {
  verdict: 'allow' | 'reject' | 'review'
  confidence: number
  rejectionReasons?: string[]
}

export async function loadNSFWModel(): Promise<void> {
  throw new Error('NSFW model is web-only on this build')
}

export async function analyzeImageContent(
  _input: NsfwImageInput,
): Promise<NsfwAnalysisResult> {
  return { verdict: 'allow', confidence: 1, rejectionReasons: [] }
}

export async function analyzeBatchImageContent(
  inputs: NsfwImageInput[],
): Promise<NsfwAnalysisResult[]> {
  return inputs.map(() => ({ verdict: 'allow' as const, confidence: 1 }))
}
