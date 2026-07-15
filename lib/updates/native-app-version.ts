import Constants from 'expo-constants'

/** Installed native binary version (store build), not the OTA bundle id. */
export function getNativeAppVersion(): string {
  const fromNative =
    Constants.nativeAppVersion ??
    Constants.expoConfig?.version ??
    (typeof process !== 'undefined' ? process.env.npm_package_version : undefined)

  const trimmed = typeof fromNative === 'string' ? fromNative.trim() : ''
  return trimmed.length > 0 ? trimmed : '0.0.0'
}
