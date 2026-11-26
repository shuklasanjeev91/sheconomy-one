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

function isHardReject(result: Verdict | null | undefined): boolean {
  if (!result || result.verdict !== 'rejected') return false
  const reasons = (result.reasons || []).map(String)
  // Infrastructure / parse failures must not block member uploads.
  if (reasons.length === 0) return true
  if (reasons.every((reason) => reason === 'moderation_unavailable' || reason === 'unreadable')) {
    return false
  }
  return true
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
    if (!result) return null
    if (isHardReject(result)) return BLOCKED_CONTENT_MESSAGE
    return null
  } catch {
    // Missed check → allow. Blocking on outages caused false "sexual content" errors.
    return null
  }
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
 * Video cannot be checked frame by frame, so a video is allowed.
 * Files that are not images (documents, for example) are left unchanged.
 *
 * Hard gate is on-device NSFWJS on web (porn/hentai only — not "sexy" alone).
 * Native uploads fail open: server vision false-positives on clothed portraits
 * were blocking profile, chat, and post photos across the app.
 */
export async function blockedImageMessage(input: {
  mimeType?: string | null
  body?: ScreenBody | null
}): Promise<string | null> {
  const mime = (input.mimeType || 'image/jpeg').toLowerCase()
  if (!mime.startsWith('image/')) return null
  if (!input.body) return null

  const local = await screenWithLocalClassifier(input.body)
  if (local === 'rejected') return BLOCKED_CONTENT_MESSAGE
  return null
}
