import { requireOptionalNativeModule } from 'expo'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

import PlayInAppUpdate from '~/modules/play-in-app-update'

type EmbeddedAppConfig = {
  version?: string
  ios?: { buildNumber?: string }
  android?: { versionCode?: number }
}

/**
 * The app config baked into the binary at build time (iOS passes an object,
 * Android a JSON string). Unlike Constants.expoConfig, an OTA can't replace it.
 */
function readEmbeddedAppConfig(): EmbeddedAppConfig | null {
  const raw = requireOptionalNativeModule<{ manifest?: unknown }>('ExponentConstants')?.manifest
  if (raw && typeof raw === 'object') return raw as EmbeddedAppConfig
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw) as EmbeddedAppConfig
  } catch {
    return null
  }
}

function readInstalledAndroidVersion() {
  try {
    return PlayInAppUpdate?.getInstalledVersion() ?? null
  } catch {
    return null
  }
}

/**
 * Installed native binary version (store build), not the OTA bundle id.
 * Constants.expoConfig is the running OTA's manifest, so it reports the app.json
 * version at publish time and must only be a last resort.
 */
export function getNativeAppVersion(): string {
  const fromNative =
    readInstalledAndroidVersion()?.versionName ??
    readEmbeddedAppConfig()?.version ??
    Constants.expoConfig?.version ??
    (typeof process !== 'undefined' ? process.env.npm_package_version : undefined)

  const trimmed = typeof fromNative === 'string' ? fromNative.trim() : ''
  return trimmed.length > 0 ? trimmed : '0.0.0'
}

/** Native build number (iOS CFBundleVersion / Android versionCode). */
export function getNativeBuildNumber(): string {
  const embedded = readEmbeddedAppConfig()
  const fromNative =
    Platform.OS === 'ios'
      ? (Constants.platform?.ios?.buildNumber ??
        embedded?.ios?.buildNumber ??
        Constants.expoConfig?.ios?.buildNumber)
      : (readInstalledAndroidVersion()?.versionCode ??
        embedded?.android?.versionCode ??
        Constants.expoConfig?.android?.versionCode)

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
