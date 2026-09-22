import { Platform } from 'react-native'

/**
 * Store binaries below this versionCode shipped without MediaProjection FGS
 * (Play policy strip). Present works on Android from this build onward.
 */
export const ANDROID_PRESENT_MIN_VERSION_CODE = 182

export const ANDROID_PRESENT_UNAVAILABLE_MESSAGE =
  'Update SHEconomy from the Play Store to Present from this Android phone. Until then, share from iPhone or the web. You can still view others’ shared screens.'

function readAndroidNativeVersionCode(): number | null {
  if (Platform.OS !== 'android') return null
  try {
    // Native APK versionCode — not the OTA expoConfig version.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default as { nativeBuildVersion?: string | number }
    const n = Number(Constants?.nativeBuildVersion)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/**
 * True on older Play binaries that stripped MediaProjection.
 * Unknown versionCode is treated as unavailable so FGS-stripped 6.0.11
 * cannot publish a black Present track.
 */
export function androidPresentUnavailable(versionCode = readAndroidNativeVersionCode()): boolean {
  if (Platform.OS !== 'android') return false
  if (versionCode == null) return true
  return versionCode < ANDROID_PRESENT_MIN_VERSION_CODE
}
