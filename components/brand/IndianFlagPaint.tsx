import { useEffect } from 'react'
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

const SAFFRON = '#FF9933'
const WHITE = '#FFFFFF'
const GREEN = '#138808'

type IndianFlagPaintProps = {
  /** Rough width of the paint cluster. */
  size?: number
}

/**
 * Festive painted tricolor (Flipkart/Amazon style) — soft brush strokes,
 * not a rectangular national flag. Subtle draw + shimmer animation.
 */
export function IndianFlagPaint({ size = 22 }: IndianFlagPaintProps) {
  const progress = useSharedValue(0)
  const shimmer = useSharedValue(0)
  const reduceMotion = useSharedValue(0)

  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      if (!mounted) return
      reduceMotion.value = enabled ? 1 : 0
      if (enabled) {
        progress.value = 1
        shimmer.value = 0
        return
      }
      progress.value = 0
      progress.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })
      shimmer.value = withDelay(
        900,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        ),
      )
    })
    return () => {
      mounted = false
    }
  }, [progress, shimmer, reduceMotion])

  const saffronStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.4) * (0.82 + shimmer.value * 0.18),
    transform: [
      { rotate: '-28deg' },
      { translateX: (1 - progress.value) * -6 },
      { scaleX: 0.55 + progress.value * 0.45 },
    ],
  }))

  const whiteStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, (progress.value - 0.18) * 1.5)) * (0.9 + shimmer.value * 0.1),
    transform: [
      { rotate: '-28deg' },
      { translateX: (1 - progress.value) * -4 },
      { scaleX: 0.55 + progress.value * 0.45 },
    ],
  }))

  const greenStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, (progress.value - 0.36) * 1.6)) * (0.82 + shimmer.value * 0.18),
    transform: [
      { rotate: '-28deg' },
      { translateX: (1 - progress.value) * -2 },
      { scaleX: 0.55 + progress.value * 0.45 },
    ],
  }))

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
      <Animated.View
        style={[
          styles.stroke,
          {
            width: strokeW,
            height: strokeH,
            backgroundColor: SAFFRON,
            top: 0,
            borderRadius: strokeH,
          },
          saffronStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.stroke,
          {
            width: strokeW * 0.95,
            height: strokeH * 0.9,
            backgroundColor: WHITE,
            top: strokeH + gap,
            borderRadius: strokeH,
            borderWidth: Platform.OS === 'web' ? 0.5 : StyleSheet.hairlineWidth,
            borderColor: 'rgba(0,0,0,0.12)',
          },
          whiteStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.stroke,
          {
            width: strokeW * 0.9,
            height: strokeH,
            backgroundColor: GREEN,
            top: (strokeH + gap) * 2,
            borderRadius: strokeH,
          },
          greenStyle,
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
    // Soft painted edge
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 0.5 },
  },
})
