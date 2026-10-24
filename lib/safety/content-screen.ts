import { Platform } from 'react-native'

import { invokeOwnedAssist } from '~/lib/ai/owned-service'

export const BLOCKED_CONTENT_MESSAGE =
  "This can't be posted. Remove sexual content and try again."

type ScreenBody = Blob | File | ArrayBuffer | Uint8Array

type Verdict = {
  verdict?: string
  reasons?: string[]
}

function joinedText(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join('\n')
    .trim()
}

/** Returns the member-facing block message, or null when the text can be saved. */
export async function blockedContentMessage(
  parts: string | Array<string | null | undefined>,
): Promise<string | null> {
  const text = (Array.isArray(parts) ? joinedText(parts) : parts.trim()).slice(0, 4000)
  if (!text) return null
  try {
    const result = await invokeOwnedAssist<Verdict>({
      action: 'moderate_text',
      product: 'account',
      message: text,
    })
    if (result?.verdict === 'approved') return null
  } catch {
    // A missed check is treated the same as a rejection.
  }
  return BLOCKED_CONTENT_MESSAGE
}

async function bytesToDataUrl(body: ScreenBody, mimeType: string): Promise<string> {
  if (typeof Blob !== 'undefined' && body instanceof Blob && typeof FileReader !== 'undefined') {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Could not read image'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(body)
    })
  }

  const bytes =
    body instanceof ArrayBuffer
      ? new Uint8Array(body)
      : body instanceof Uint8Array
        ? body
        : new Uint8Array(await body.arrayBuffer())
  let binary = ''
  const step = 0x8000
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step))
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : ''
  if (!base64) return ''
  return `data:${mimeType || 'image/jpeg'};base64,${base64}`
}

async function screenWithLocalClassifier(body: ScreenBody): Promise<'approved' | 'rejected' | null> {
  if (Platform.OS !== 'web' || typeof Blob === 'undefined' || !(body instanceof Blob)) return null
  try {
    const { nsfwImageModerator } = await import('~/lib/nsfwjs/listing-image-moderator')
    const result = await nsfwImageModerator.analyze(body)
    if (result.verdict === 'approved') return 'approved'
    if (result.reasons.includes('moderation_unavailable')) return null
    return 'rejected'
  } catch {
    return null
  }
}

/**
 * Returns the member-facing block message, or null when the file can be uploaded.
 * Video cannot be checked frame by frame, so a video upload is refused.
 * Files that are not images or video (documents, for example) are left unchanged.
 */
export async function blockedImageMessage(input: {
  mimeType?: string | null
  body?: ScreenBody | null
}): Promise<string | null> {
  const mime = (input.mimeType || 'image/jpeg').toLowerCase()
  if (mime.startsWith('video/')) return BLOCKED_CONTENT_MESSAGE
  if (!mime.startsWith('image/')) return null
  if (!input.body) return BLOCKED_CONTENT_MESSAGE

  const local = await screenWithLocalClassifier(input.body)
  if (local === 'approved') return null
  if (local === 'rejected') return BLOCKED_CONTENT_MESSAGE

  try {
    const dataUrl = await bytesToDataUrl(input.body, mime)
    if (!dataUrl.startsWith('data:image/')) return BLOCKED_CONTENT_MESSAGE
    const result = await invokeOwnedAssist<Verdict>({
      action: 'moderate_image',
      product: 'account',
      message: dataUrl.slice(0, 3_500_000),
    })
    if (result?.verdict === 'approved') return null
  } catch {
    // A missed check is treated the same as a rejection.
  }
  return BLOCKED_CONTENT_MESSAGE
}
