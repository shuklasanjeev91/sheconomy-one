/**
 * Native listing image moderator — server-side vision via ai-assist.
 * Keeps native uploads from fail-open when client TF.js is unavailable.
 */

import type {
  ImageModerationResult,
  ImageModerator,
} from '~/lib/listing/listing-images.service'
import { supabase } from '~/lib/supabase'

async function blobToDataUrl(image: Blob | File): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Could not read image'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(image)
    })
  }

  const buffer = await image.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  // eslint-disable-next-line no-undef -- RN provides btoa via polyfills in this app
  const base64 = typeof btoa === 'function' ? btoa(binary) : ''
  const mime = image.type || 'image/jpeg'
  return `data:${mime};base64,${base64}`
}

async function moderateViaServer(image: Blob | File): Promise<ImageModerationResult> {
  const dataUrl = await blobToDataUrl(image)
  if (!dataUrl) {
    return { verdict: 'approved', reasons: [], confidence: 0 }
  }

  const { data, error } = await supabase.functions.invoke('ai-assist', {
    body: {
      action: 'moderate_image',
      product: 'commerce',
      message: dataUrl.slice(0, 2_000_000),
      context: {
        mime_type: image.type || 'image/jpeg',
      },
    },
  })

  if (error) {
    // Fail closed for safety on native when the moderator cannot run.
    return {
      verdict: 'rejected',
      reasons: ['moderation_unavailable'],
      confidence: 1,
    }
  }

  const payload = data as {
    verdict?: string
    reasons?: string[]
    confidence?: number
  } | null

  if (payload?.verdict === 'rejected') {
    return {
      verdict: 'rejected',
      reasons: Array.isArray(payload.reasons) ? payload.reasons.map(String) : ['inappropriate'],
      confidence: typeof payload.confidence === 'number' ? payload.confidence : 1,
    }
  }

  return {
    verdict: 'approved',
    reasons: [],
    confidence: typeof payload?.confidence === 'number' ? payload.confidence : 1,
  }
}

export const nsfwImageModerator: ImageModerator = {
  async analyze(image) {
    return moderateViaServer(image)
  },
}
