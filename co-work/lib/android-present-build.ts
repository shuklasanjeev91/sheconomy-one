import Constants from 'expo-constants'
import { Platform } from 'react-native'

/**
 * Android Present needs MediaProjection FGS in the native binary.
 * Store builds before versionCode 170 stripped that service — OTA cannot restore it.
 * Build 171+ also includes the MediaProjection startCapture race fix.
 */
export const ANDROID_PRESENT_MIN_VERSION_CODE = 170

export function getAndroidNativeVersionCode(): number | null {
  if (Platform.OS !== 'android') return null
  const raw = Constants.nativeBuildVersion
  const code = Number(raw)
  return Number.isFinite(code) && code > 0 ? code : null
}

/** True when this installed Android binary cannot publish real screen-share frames. */
export function androidPresentNeedsNativeUpdate(): boolean {
  const code = getAndroidNativeVersionCode()
  if (code == null) return false
  return code < ANDROID_PRESENT_MIN_VERSION_CODE
}
