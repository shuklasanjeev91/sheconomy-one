import { StyleSheet, View } from 'react-native'

import { brandColors } from '~/config/brand-colors'

/**
 * Lightweight route/gate placeholder — plain RN View only.
 * Must NOT use Tamagui (`YStack` / theme hooks): this element is mounted as
 * One's Suspense fallback via `globalThis.__SHECONOMY_SUSPENSE_FALLBACK__`
 * before TamaguiProvider is available.
 *
 * Soft rose wash (not splash.png) so HomeScreen can paint immediately.
 */
export function BrandSplashFallback() {
  return <View style={styles.root} />
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: brandColors.roseTint,
  },
})
