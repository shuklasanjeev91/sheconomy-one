import { useFonts } from 'expo-font'

/**
 * Native (iOS/Android, bundled by Metro): `require()` resolves the .otf as a
 * Metro asset module id, which `expo-font` loads via its native module. See
 * `useAppFonts.web.ts` for the Vite/SSR-safe counterpart — Vite's ESM output
 * has no `require`, so that file statically imports the same files as URLs.
 */
export function useAppFonts() {
  return useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })
}
