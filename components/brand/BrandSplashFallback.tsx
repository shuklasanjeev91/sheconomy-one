import { Image, StyleSheet, View } from 'react-native'

import { BRAND_NAME } from '~/config/brand'
import { brandColors } from '~/config/brand-colors'

/** Bundled logo — never depends on network during cold start. */
const brandLogo = require('../../public/app-icon.png')

/**
 * Full-screen brand splash — magenta background + centered logo.
 * Used while native gates / async routes resolve so cold start never
 * shows an empty brand-colored frame.
 */
export function BrandSplashFallback() {
  return (
    <View style={styles.root} accessibilityRole="image" accessibilityLabel={BRAND_NAME}>
      <Image
        source={brandLogo}
        style={styles.logo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandColors.primary,
  },
  logo: {
    width: 168,
    height: 168,
  },
})
