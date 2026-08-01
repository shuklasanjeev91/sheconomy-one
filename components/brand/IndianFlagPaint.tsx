import { StyleSheet, View } from 'react-native'

const SAFFRON = '#FF9933'
const WHITE = '#FFFFFF'
const GREEN = '#138808'

type IndianFlagPaintProps = {
  /** Rough width of the paint cluster. */
  size?: number
}

/**
 * SSR/web painted tricolor — no react-native-reanimated (avoids Vercel FUNCTION_INVOCATION_FAILED).
 */
export function IndianFlagPaint({ size = 22 }: IndianFlagPaintProps) {
  const strokeW = Math.max(18, size * 1.15)
  const strokeH = Math.max(3.5, size * 0.22)
  const gap = Math.max(1.5, size * 0.08)

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.wrap,
        {
          width: size * 1.35,
          height: size * 1.1,
        },
      ]}
    >
      <View
        style={[
          styles.stroke,
          {
            width: strokeW,
            height: strokeH,
            backgroundColor: SAFFRON,
            top: 0,
            borderRadius: strokeH,
            opacity: 0.92,
          },
        ]}
      />
      <View
        style={[
          styles.stroke,
          {
            width: strokeW * 0.95,
            height: strokeH * 0.9,
            backgroundColor: WHITE,
            top: strokeH + gap,
            borderRadius: strokeH,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(0,0,0,0.12)',
            opacity: 0.95,
          },
        ]}
      />
      <View
        style={[
          styles.stroke,
          {
            width: strokeW * 0.9,
            height: strokeH,
            backgroundColor: GREEN,
            top: (strokeH + gap) * 2,
            borderRadius: strokeH,
            opacity: 0.92,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'visible',
  },
  stroke: {
    position: 'absolute',
    left: 0,
    transform: [{ rotate: '-28deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 0.5 },
  },
})
