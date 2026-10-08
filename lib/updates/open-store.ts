import { Linking, Platform } from 'react-native'

import { ANDROID_PACKAGE_ID } from '~/lib/platform/open-in-app'
import { startPlayImmediateUpdate } from '~/lib/updates/play-in-app-update'
import { getAndroidPlayStoreUrl, getIosStoreUrl } from '~/lib/updates/remote-config'

/** Store links to try in order: the store app first, then the web listing. */
export function storeUrlCandidates(platform: string = Platform.OS): string[] {
  if (platform === 'ios') {
    const web = getIosStoreUrl()
    return web ? [web.replace(/^https?:/, 'itms-apps:'), web] : []
  }
  const web = getAndroidPlayStoreUrl()
  return [`market://details?id=${ANDROID_PACKAGE_ID}`, ...(web ? [web] : [])]
}

export async function openStoreListing(): Promise<boolean> {
  for (const url of storeUrlCandidates()) {
    try {
      await Linking.openURL(url)
      return true
    } catch {
      // Try the next candidate (e.g. no Play Store app on the device).
    }
  }
  return false
}

/**
 * Send the user to install the latest store build. On Android, Google Play's
 * in-app update runs first; the store listing is the fallback. Resolves false
 * when nothing could be opened.
 */
export async function openAppStore(options: { fallbackOnCancel?: boolean } = {}): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await startPlayImmediateUpdate()
    if (result === 'accepted') return true
    if (result === 'cancelled' && !options.fallbackOnCancel) return true
  }

  return openStoreListing()
}
