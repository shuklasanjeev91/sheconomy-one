/** Pure helper — safe to import from Vitest without loading react-native. */
export function isNativeFullscreenForPlatform(os: string): boolean {
  return os === 'ios' || os === 'android'
}

/** Full-viewport snap for Tamagui Sheet on native. */
export const NATIVE_FULLSCREEN_SNAP_POINTS = [100] as const
