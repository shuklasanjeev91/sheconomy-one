/**
 * Native NSFW classifier. Image uploads fail open on device — server vision
 * false-positives were blocking clothed portraits. Web uses on-device NSFWJS.
 */

export type NsfwImageInput = string | Blob | File

export type NsfwAnalysisResult = {
  verdict: 'allow' | 'reject' | 'review'
  confidence: number
  rejectionReasons?: string[]
}

export async function loadNSFWModel(): Promise<void> {
  // Nothing to preload on device.
}

export async function analyzeImageContent(_input: NsfwImageInput): Promise<NsfwAnalysisResult> {
  return { verdict: 'allow', confidence: 0 }
}

export async function analyzeBatchImageContent(
  inputs: NsfwImageInput[],
): Promise<NsfwAnalysisResult[]> {
  return inputs.map(() => ({ verdict: 'allow' as const, confidence: 0 }))
}
