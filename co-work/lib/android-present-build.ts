import { NativeModules, Platform } from 'react-native'

/**
 * Store binaries below this versionCode shipped without MediaProjection FGS.
 * Present works on Android from this build onward (user-initiated screen share).
 */
export const ANDROID_PRESENT_MIN_VERSION_CODE = 197

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

/** True when this binary still links WebRTC MediaProjection. */
export function androidHasMediaProjectionService(): boolean {
  if (Platform.OS !== 'android') return false
  try {
    const webrtc = NativeModules.WebRTCModule as
      | { mediaStreamTrackSetVideoEffects?: unknown; getDisplayMedia?: unknown }
      | undefined
    return !!webrtc
  } catch {
    return false
  }
}

/**
 * True when Android Present cannot run on this install.
 * Allow Present when MediaProjection is linked and the store binary is new enough
 * (6.0.19 / 192 stripped FGS for a temporary Play resubmit).
 */
export function androidPresentUnavailable(versionCode = readAndroidNativeVersionCode()): boolean {
  if (Platform.OS !== 'android') return false
  if (!androidHasMediaProjectionService()) {
    if (versionCode == null) return true
    return versionCode < ANDROID_PRESENT_MIN_VERSION_CODE
  }
  // 192 and below intentionally disabled Present for Play policy.
  if (versionCode != null && versionCode > 0 && versionCode < ANDROID_PRESENT_MIN_VERSION_CODE) {
    return true
  }
  return false
}
