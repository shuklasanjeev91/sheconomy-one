import type { ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'

import { Text, XStack } from '~/components/ui'
import { useScreenZoom } from '~/lib/zoom/ScreenZoomContext'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * Wraps app content so screen zoom enlarges every word, icon, and image together.
 * Web: CSS `zoom` on documentElement (sharp text).
 * Native: do not use transform-scale wrappers — they break Switch/Radio/Button hit testing.
 */
export function ScreenZoomRoot({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    return <>{children}</>
  }

  return <View style={styles.fill}>{children}</View>
}

/** Floating − / % / + controls — each + enlarges every word on screen (web CSS zoom). */
export function ScreenZoomControls({
  tone = 'dark',
}: {
  tone?: 'dark' | 'light'
}) {
  const { percentLabel, canZoomIn, canZoomOut, zoomIn, zoomOut, reset } = useScreenZoom()
  const ui = useAppUi()
  const bg = tone === 'dark' ? ui.chromeBg : ui.chromeBg
  const fg = tone === 'dark' ? ui.overlayDotActive ?? '#fff' : ui.text

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
        hitSlop={8}
        style={{ opacity: canZoomOut ? 1 : 0.35, paddingHorizontal: 10, paddingVertical: 6 }}
      >
        <Text color={fg} fontSize={20} fontWeight="700" lineHeight={22}>
          −
        </Text>
      </Pressable>
      <Pressable
        onPress={reset}
        accessibilityLabel={`Zoom ${percentLabel}, tap to reset`}
        hitSlop={8}
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
        hitSlop={8}
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
