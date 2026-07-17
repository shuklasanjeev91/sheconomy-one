import Constants from 'expo-constants'
import { Platform } from 'react-native'

/** Installed native binary version (store build), not the OTA bundle id. */
export function getNativeAppVersion(): string {
  const fromNative =
    Constants.nativeAppVersion ??
    Constants.expoConfig?.version ??
    (typeof process !== 'undefined' ? process.env.npm_package_version : undefined)

  const trimmed = typeof fromNative === 'string' ? fromNative.trim() : ''
  return trimmed.length > 0 ? trimmed : '0.0.0'
}

/** Native build number (iOS CFBundleVersion / Android versionCode). */
export function getNativeBuildNumber(): string {
  const fromNative =
    Constants.nativeBuildVersion ??
    (Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode != null
        ? String(Constants.expoConfig.android.versionCode)
        : undefined)

  const trimmed = typeof fromNative === 'string' ? fromNative.trim() : ''
  if (trimmed.length > 0) return trimmed
  if (typeof fromNative === 'number' && Number.isFinite(fromNative)) {
    return String(fromNative)
  }
  return Platform.OS === 'android' ? '102' : '96'
}

/** Home-screen / About display name. */
export function getAppDisplayName(): string {
  const infoPlist = Constants.expoConfig?.ios?.infoPlist as
    | Record<string, unknown>
    | undefined
  const fromPlist = infoPlist?.CFBundleDisplayName
  const fromConfig = Constants.expoConfig?.name

  for (const candidate of [fromConfig, fromPlist]) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return 'SHEconomy'
}

/** Human-readable version line for Settings → About. */
export function getAppVersionLabel(): string {
  const name = getAppDisplayName()
  const version = getNativeAppVersion()
  const build = getNativeBuildNumber()

  if (Platform.OS === 'android') {
    return `${name} · ${version} (${build})`
  }
  return `${name} · ${version} (${build})`
}
