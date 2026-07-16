import type { ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'

import { Text, XStack } from '~/components/ui'
import { useScreenZoom } from '~/lib/zoom/ScreenZoomContext'

/**
 * Wraps app content so screen zoom enlarges every word, icon, and image together.
 * Web: CSS `zoom` on documentElement (sharp text). Native: scale + layout expand.
 */
export function ScreenZoomRoot({ children }: { children: ReactNode }) {
  const { scale } = useScreenZoom()

  if (Platform.OS === 'web') {
    // Applied on documentElement inside ScreenZoomProvider effect —
    // keep children untransformed so layout math stays correct under CSS zoom.
    return <>{children}</>
  }

  if (scale === 1) {
    return <View style={styles.fill}>{children}</View>
  }

  const pct = `${(100 / scale).toFixed(4)}%`
  return (
    <View style={styles.fill}>
      <View style={[styles.fill, { width: pct, height: pct, transform: [{ scale }] }]}>
        {children}
      </View>
    </View>
  )
}

/** Floating − / % / + controls — each + enlarges every word on screen. */
export function ScreenZoomControls({
  tone = 'dark',
}: {
  tone?: 'dark' | 'light'
}) {
  const { percentLabel, canZoomIn, canZoomOut, zoomIn, zoomOut, reset } = useScreenZoom()
  const bg = tone === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.92)'
  const fg = tone === 'dark' ? '#fff' : '#1a0a12'

  return (
    <XStack
      gap={4}
      alignItems="center"
      paddingHorizontal={6}
      paddingVertical={4}
      borderRadius={999}
      backgroundColor={bg}
    >
      <Pressable
        onPress={zoomOut}
        disabled={!canZoomOut}
        accessibilityLabel="Zoom out"
        style={{ opacity: canZoomOut ? 1 : 0.35, paddingHorizontal: 10, paddingVertical: 6 }}
      >
        <Text color={fg} fontSize={20} fontWeight="700" lineHeight={22}>
          −
        </Text>
      </Pressable>
      <Pressable
        onPress={reset}
        accessibilityLabel={`Zoom ${percentLabel}, tap to reset`}
        style={{ paddingHorizontal: 6, paddingVertical: 6, minWidth: 48 }}
      >
        <Text color={fg} fontSize={12} fontWeight="700" textAlign="center">
          {percentLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={zoomIn}
        disabled={!canZoomIn}
        accessibilityLabel="Zoom in"
        style={{ opacity: canZoomIn ? 1 : 0.35, paddingHorizontal: 10, paddingVertical: 6 }}
      >
        <Text color={fg} fontSize={20} fontWeight="700" lineHeight={22}>
          +
        </Text>
      </Pressable>
    </XStack>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
