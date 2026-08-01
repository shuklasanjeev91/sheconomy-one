import { ActivityIndicator, StyleSheet, View } from 'react-native'

/**
 * Neutral native boot placeholder — never brand-magenta.
 * Magenta full-screens (BrandSplashFallback / splash windowBackground) were
 * sticking as "unwanted blank screens" after splash hide races.
 */
export function NativeBootPlaceholder() {
  return (
    <View style={styles.root} accessibilityLabel="Loading">
      <ActivityIndicator size="large" color="#D81B60" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
})
