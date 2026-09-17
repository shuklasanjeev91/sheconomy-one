import { Linking, Platform } from 'react-native'
import type { Href } from 'one'

import { navigateApp } from '~/lib/platform/navigate'
import { inAppPathFromUrl } from '~/lib/platform/inAppPath'

export { inAppPathFromUrl } from '~/lib/platform/inAppPath'

/**
 * Accept only well-formed http(s) URLs, normalized. Use before rendering any
 * user- or vendor-supplied link so `javascript:` / `data:` schemes can't slip
 * through. Returns `null` when the value is unusable.
 */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Soft in-app SPA navigation, or open true externals outside the shell.
 * Never assigns `window.location` (no hard reload).
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false

  const inApp = inAppPathFromUrl(url)
  if (inApp) {
    navigateApp(inApp as Href)
    return true
  }

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    return Boolean(opened)
  }

  try {
    // Android often reports canOpenURL=false for https OAuth URLs unless every
    // host is listed in queries — still attempt openURL for http(s).
    const isHttp = /^https?:\/\//i.test(url)
    if (!isHttp) {
      const canOpen = await Linking.canOpenURL(url)
      if (!canOpen) return false
    }
    await Linking.openURL(url)
    return true
  } catch {
    return false
  }
}

/** Alias used by media / help surfaces. */
export const openUrl = openExternalUrl
