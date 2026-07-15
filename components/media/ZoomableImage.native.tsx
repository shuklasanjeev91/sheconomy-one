import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { Image as RNImage, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import {
  IMAGE_ZOOM_MAX,
  IMAGE_ZOOM_MIN,
  IMAGE_ZOOM_STEP,
  nextZoomIn,
} from '~/lib/zoom/zoom-levels'

const DOUBLE_TAP_MS = 300

export type ZoomableImageHandle = {
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  getScale: () => number
}

export type ZoomableImageProps = {
  uri: string
  alt?: string
  onZoomChange?: (zoomed: boolean) => void
  onScaleChange?: (scale: number) => void
  onTap?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

/** LinkedIn-style zoom for iOS/Android: multi-step +/−, pinch, double-tap, pan. */
export const ZoomableImage = forwardRef<ZoomableImageHandle, ZoomableImageProps>(
  function ZoomableImage(
    { uri, alt = '', onZoomChange, onScaleChange, onTap, onSwipeLeft, onSwipeRight },
    ref,
  ) {
    const scale = useSharedValue(1)
    const savedScale = useSharedValue(1)
    const tx = useSharedValue(0)
    const ty = useSharedValue(0)
    const savedTx = useSharedValue(0)
    const savedTy = useSharedValue(0)
    const layoutW = useSharedValue(0)
    const layoutH = useSharedValue(0)
    const zoomedRef = useRef(false)
    const scaleJsRef = useRef(1)
    const onZoomChangeRef = useRef(onZoomChange)
    const onScaleChangeRef = useRef(onScaleChange)
    const onTapRef = useRef(onTap)
    const onSwipeLeftRef = useRef(onSwipeLeft)
    const onSwipeRightRef = useRef(onSwipeRight)
    onZoomChangeRef.current = onZoomChange
    onScaleChangeRef.current = onScaleChange
    onTapRef.current = onTap
    onSwipeLeftRef.current = onSwipeLeft
    onSwipeRightRef.current = onSwipeRight

    const notifyScale = useCallback((value: number) => {
      scaleJsRef.current = value
      onScaleChangeRef.current?.(value)
      const zoomed = value > 1.02
      if (zoomed !== zoomedRef.current) {
        zoomedRef.current = zoomed
        onZoomChangeRef.current?.(zoomed)
      }
    }, [])

    const fireTap = useCallback(() => {
      onTapRef.current?.()
    }, [])

    const fireSwipeLeft = useCallback(() => {
      onSwipeLeftRef.current?.()
    }, [])

    const fireSwipeRight = useCallback(() => {
      onSwipeRightRef.current?.()
    }, [])

    const zoomIn = useCallback(() => {
      const next = nextZoomIn(scaleJsRef.current, IMAGE_ZOOM_STEP, IMAGE_ZOOM_MAX)
      scale.value = withTiming(next)
      savedScale.value = next
      notifyScale(next)
    }, [scale, savedScale, notifyScale])

    const zoomOut = useCallback(() => {
      const next = Math.max(IMAGE_ZOOM_MIN, Math.round((scaleJsRef.current / IMAGE_ZOOM_STEP) * 100) / 100)
      scale.value = withTiming(next)
      savedScale.value = next
      if (next <= 1.01) {
        tx.value = withTiming(0)
        ty.value = withTiming(0)
        savedTx.value = 0
        savedTy.value = 0
      }
      notifyScale(next)
    }, [scale, savedScale, tx, ty, savedTx, savedTy, notifyScale])

    const reset = useCallback(() => {
      scale.value = withTiming(1)
      savedScale.value = 1
      tx.value = withTiming(0)
      ty.value = withTiming(0)
      savedTx.value = 0
      savedTy.value = 0
      notifyScale(1)
    }, [scale, savedScale, tx, ty, savedTx, savedTy, notifyScale])

    useImperativeHandle(
      ref,
      () => ({
        zoomIn,
        zoomOut,
        reset,
        getScale: () => scaleJsRef.current,
      }),
      [zoomIn, zoomOut, reset],
    )

    useEffect(() => {
      scale.value = 1
      savedScale.value = 1
      tx.value = 0
      ty.value = 0
      savedTx.value = 0
      savedTy.value = 0
      notifyScale(1)
    }, [uri, scale, savedScale, tx, ty, savedTx, savedTy, notifyScale])

    const pinch = Gesture.Pinch()
      .onStart(() => {
        savedScale.value = scale.value
      })
      .onUpdate((e) => {
        const next = Math.min(IMAGE_ZOOM_MAX, Math.max(IMAGE_ZOOM_MIN, savedScale.value * e.scale))
        scale.value = next
        if (next <= 1.01) {
          tx.value = 0
          ty.value = 0
        }
        runOnJS(notifyScale)(next)
      })
      .onEnd(() => {
        if (scale.value < 1.05) {
          scale.value = withTiming(1)
          tx.value = withTiming(0)
          ty.value = withTiming(0)
          savedScale.value = 1
          savedTx.value = 0
          savedTy.value = 0
          runOnJS(notifyScale)(1)
        } else {
          savedScale.value = scale.value
          savedTx.value = tx.value
          savedTy.value = ty.value
        }
      })

    const pan = Gesture.Pan()
      .averageTouches(true)
      .onStart(() => {
        savedTx.value = tx.value
        savedTy.value = ty.value
      })
      .onUpdate((e) => {
        if (scale.value <= 1.02) return
        const maxX = (layoutW.value * (scale.value - 1)) / 2
        const maxY = (layoutH.value * (scale.value - 1)) / 2
        tx.value = Math.min(maxX, Math.max(-maxX, savedTx.value + e.translationX))
        ty.value = Math.min(maxY, Math.max(-maxY, savedTy.value + e.translationY))
      })
      .onEnd((e) => {
        if (scale.value <= 1.02) {
          if (
            Math.abs(e.translationX) > 56 &&
            Math.abs(e.translationX) > Math.abs(e.translationY) * 1.35
          ) {
            if (e.translationX < 0) runOnJS(fireSwipeLeft)()
            else runOnJS(fireSwipeRight)()
          }
          return
        }
        savedTx.value = tx.value
        savedTy.value = ty.value
      })

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(DOUBLE_TAP_MS)
      .onEnd((e) => {
        if (scale.value >= IMAGE_ZOOM_MAX - 0.05) {
          scale.value = withTiming(1)
          tx.value = withTiming(0)
          ty.value = withTiming(0)
          savedScale.value = 1
          savedTx.value = 0
          savedTy.value = 0
          runOnJS(notifyScale)(1)
          return
        }
        const next = nextZoomIn(scale.value, IMAGE_ZOOM_STEP, IMAGE_ZOOM_MAX)
        const cx = e.x - layoutW.value / 2
        const cy = e.y - layoutH.value / 2
        const ratio = next / Math.max(scale.value, 0.01)
        const nextTx = cx - (cx - tx.value) * ratio
        const nextTy = cy - (cy - ty.value) * ratio
        scale.value = withTiming(next)
        tx.value = withTiming(nextTx)
        ty.value = withTiming(nextTy)
        savedScale.value = next
        savedTx.value = nextTx
        savedTy.value = nextTy
        runOnJS(notifyScale)(next)
      })

    const singleTap = Gesture.Tap()
      .numberOfTaps(1)
      .maxDuration(DOUBLE_TAP_MS)
      .requireExternalGestureToFail(doubleTap)
      .onEnd(() => {
        if (scale.value <= 1.05) runOnJS(fireTap)()
      })

    const composed = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap))

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
    }))

    return (
      <GestureHandlerRootView style={styles.fill}>
        <GestureDetector gesture={composed}>
          <View
            style={styles.fill}
            collapsable={false}
            onLayout={(event: LayoutChangeEvent) => {
              layoutW.value = event.nativeEvent.layout.width
              layoutH.value = event.nativeEvent.layout.height
            }}
          >
            <Animated.View style={[styles.fill, styles.center, animatedStyle]}>
              <RNImage
                source={{ uri }}
                accessibilityLabel={alt}
                resizeMode="contain"
                style={styles.image}
              />
            </Animated.View>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    )
  },
)

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
})
