import { Linking, Platform } from 'react-native'

import { ANDROID_PACKAGE_ID } from '~/lib/platform/open-in-app'
import { getAndroidPlayStoreUrl, getIosStoreUrl } from '~/lib/updates/remote-config'

/** Open this app's store listing; resolves false when nothing could be opened. */
export async function openAppStore(): Promise<boolean> {
  const candidates =
    Platform.OS === 'ios'
      ? [getIosStoreUrl()]
      : [`market://details?id=${ANDROID_PACKAGE_ID}`, getAndroidPlayStoreUrl()]

  for (const url of candidates) {
    if (!url) continue
    try {
      await Linking.openURL(url)
      return true
    } catch {
      // Try the next candidate (e.g. no Play Store app on the device).
    }
  }
  return false
}
