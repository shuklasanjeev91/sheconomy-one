import { NativeModules, Platform } from 'react-native'

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
 * Local / rebuilt APKs that still ship MediaProjectionService can Present even
 * when versionCode lags Play metadata (sideload / internal release).
 */
export function androidHasMediaProjectionService(): boolean {
  if (Platform.OS !== 'android') return false
  try {
    const webrtc = NativeModules.WebRTCModule as
      | { mediaStreamTrackSetVideoEffects?: unknown; getDisplayMedia?: unknown }
      | undefined
    // LiveKit RN WebRTC always registers WebRTCModule when MediaProjection is linked.
    return !!webrtc
  } catch {
    return false
  }
}

/**
 * True on older Play binaries that stripped MediaProjection.
 * Prefer allowing Present when this binary still links WebRTC MediaProjection
 * (local release / new sideloads), even if versionCode is temporarily behind.
 */
export function androidPresentUnavailable(versionCode = readAndroidNativeVersionCode()): boolean {
  if (Platform.OS !== 'android') return false
  // Binary includes MediaProjection — allow Present (Zoom-like).
  if (androidHasMediaProjectionService()) {
    // Still warn-gate only truly ancient Play builds that never had FGS at all.
    if (versionCode != null && versionCode < 160) return true
    return false
  }
  if (versionCode == null) return true
  return versionCode < ANDROID_PRESENT_MIN_VERSION_CODE
}
