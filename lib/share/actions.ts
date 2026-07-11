import { Platform, Share } from 'react-native'

import { BRAND_NAME } from '~/config/brand'
import { copyToClipboard } from '~/lib/platform/clipboard'

import type { SharePayload } from './types'

export async function copyShareLink(url: string): Promise<boolean> {
  return copyToClipboard(url)
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
