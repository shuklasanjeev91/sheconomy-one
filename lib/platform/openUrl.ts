import { Linking, Platform } from 'react-native'
import type { Href } from 'one'

import { navigateApp } from './navigate'
import { inAppPathFromUrl } from './inAppPath'

export { inAppPathFromUrl } from './inAppPath'

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
    const canOpen = await Linking.canOpenURL(url)
    if (!canOpen) return false
    await Linking.openURL(url)
    return true
  } catch {
    return false
  }
}

/** Alias used by media / help surfaces. */
export const openUrl = openExternalUrl
