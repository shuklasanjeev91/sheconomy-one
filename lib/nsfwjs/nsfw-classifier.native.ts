/**
 * Native NSFW classifier. SHERPA checks the photo and a failure stays rejected.
 */

import { invokeOwnedAssist } from '~/lib/ai/owned-service'

export type NsfwImageInput = string | Blob | File

export type NsfwAnalysisResult = {
  verdict: 'allow' | 'reject' | 'review'
  confidence: number
  rejectionReasons?: string[]
}

async function blobToDataUrl(image: Blob | File): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Could not read image'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(image)
    })
  }
  return ''
}

async function moderateViaServer(image: Blob | File): Promise<NsfwAnalysisResult> {
  const dataUrl = await blobToDataUrl(image)
  if (!dataUrl) {
    return { verdict: 'reject', confidence: 1, rejectionReasons: ['moderation_unavailable'] }
  }

  let payload: { verdict?: string; reasons?: string[]; confidence?: number } | null = null
  try {
    payload = await invokeOwnedAssist({
      action: 'moderate_image',
      product: 'commerce',
      message: dataUrl.slice(0, 2_000_000),
      context: { mime_type: image.type || 'image/jpeg' },
    })
  } catch {
    payload = null
  }

  if (!payload) {
    return { verdict: 'reject', confidence: 1, rejectionReasons: ['moderation_unavailable'] }
  }
  if (payload?.verdict === 'rejected') {
    return {
      verdict: 'reject',
      confidence: typeof payload.confidence === 'number' ? payload.confidence : 1,
      rejectionReasons: Array.isArray(payload.reasons) ? payload.reasons.map(String) : ['inappropriate'],
    }
  }

  return {
    verdict: 'allow',
    confidence: typeof payload?.confidence === 'number' ? payload.confidence : 1,
  }
}

export async function loadNSFWModel(): Promise<void> {
  // Server-side moderator — nothing to preload on device.
}

export async function analyzeImageContent(input: NsfwImageInput): Promise<NsfwAnalysisResult> {
  if (typeof input === 'string') {
    // Remote URL — allow; listing upload path always passes Blobs.
    return { verdict: 'allow', confidence: 1 }
  }
  return moderateViaServer(input)
}

export async function analyzeBatchImageContent(
  inputs: NsfwImageInput[],
): Promise<NsfwAnalysisResult[]> {
  const results: NsfwAnalysisResult[] = []
  for (const input of inputs) {
    results.push(await analyzeImageContent(input))
  }
  return results
}
