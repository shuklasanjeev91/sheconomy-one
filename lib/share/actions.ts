import { Linking, Platform, Share } from 'react-native'

import { BRAND_NAME } from '~/config/brand'
import { copyToClipboard } from '~/lib/platform/clipboard'

import type { SharePayload } from '~/lib/share/types'

export async function copyShareLink(url: string): Promise<boolean> {
  return copyToClipboard(url)
}

/** Known one-tap share destinations rendered in the share sheet. */
export type ShareTargetKey =
  | 'whatsapp'
  | 'linkedin'
  | 'x'
  | 'facebook'
  | 'telegram'
  | 'email'

/** Build the deep/intent link for a specific share destination. */
export function buildShareTargetUrl(key: ShareTargetKey, payload: SharePayload): string {
  const { url, title, text } = payload
  const trimmedText = text?.trim()
  const message = trimmedText ? `${trimmedText} ${url}` : url

  const encodedUrl = encodeURIComponent(url)
  const encodedMessage = encodeURIComponent(message)
  const encodedText = encodeURIComponent(trimmedText || title || BRAND_NAME)
  const encodedTitle = encodeURIComponent(title ?? BRAND_NAME)

  switch (key) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodedMessage}`
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    case 'x':
      return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    case 'telegram':
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
    case 'email':
      return `mailto:?subject=${encodedTitle}&body=${encodedMessage}`
  }
}

/**
 * Open a specific share destination. On web this opens a new tab/popup (or the
 * mail client for email); on native it hands off to the OS via Linking.
 */
export async function openShareTarget(
  key: ShareTargetKey,
  payload: SharePayload,
): Promise<boolean> {
  const targetUrl = buildShareTargetUrl(key, payload)

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false
    // Never assign window.location — that unloads the SPA. Open in a new context.
    const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer')
    return Boolean(opened)
  }

  try {
    await Linking.openURL(targetUrl)
    return true
  } catch {
    return false
  }
}

/** Whether the OS-level share sheet (Web Share API / native Share) is usable. */
export function canUseSystemShare(): boolean {
  if (Platform.OS !== 'web') return true
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export async function shareViaSystem(
  payload: SharePayload,
): Promise<'shared' | 'copied' | 'cancelled'> {
  const { url, title, text } = payload
  const shareTitle = title ?? BRAND_NAME
  const shareText = text?.trim() ? `${text.trim()}\n${url}` : url

  if (Platform.OS !== 'web') {
    try {
      await Share.share({
        title: shareTitle,
        message: shareText,
        url,
      })
      return 'shared'
    } catch {
      // user cancelled or unavailable
    }
  }

  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: text?.trim() || undefined,
        url,
      })
      return 'shared'
    } catch {
      // user cancelled
    }
  }

  const copied = await copyShareLink(url)
  return copied ? 'copied' : 'cancelled'
}
