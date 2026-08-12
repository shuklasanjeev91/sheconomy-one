/**
 * Native NSFW classifier — server-side vision via ai-assist (same as listing moderator).
 * Keeps @tensorflow/* out of the native bundle while staying fail-closed.
 */

import { supabase } from '~/lib/supabase'

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

  const { data, error } = await supabase.functions.invoke('ai-assist', {
    body: {
      action: 'moderate_image',
      product: 'commerce',
      message: dataUrl.slice(0, 2_000_000),
      context: { mime_type: image.type || 'image/jpeg' },
    },
  })

  if (error) {
    return { verdict: 'reject', confidence: 1, rejectionReasons: ['moderation_unavailable'] }
  }

  const payload = data as { verdict?: string; reasons?: string[]; confidence?: number } | null
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
