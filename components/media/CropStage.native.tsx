import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import { Image } from '~/components/ui'
import {
  clampCropTransform,
  type CropStageHandle,
  type CropStageProps,
  type CropTransform,
} from '~/lib/media/crop-stage'

/** Pan/pinch crop stage for native — reanimated shared values on the UI thread. */
export const CropStage = forwardRef<CropStageHandle, CropStageProps>(function CropStage(
  {
    uri,
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    minZoom,
    maxZoom,
    onTransformChange,
  },
  ref,
) {
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const scale = useSharedValue(1)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const startScale = useSharedValue(1)
  const imageW = useSharedValue(imageWidth)
  const imageH = useSharedValue(imageHeight)
  const frameW = useSharedValue(frameWidth)
  const frameH = useSharedValue(frameHeight)
  const minScale = useSharedValue(minZoom)
  const maxScale = useSharedValue(maxZoom)

  const readTransform = (): CropTransform => ({
    x: translateX.value,
    y: translateY.value,
    scale: scale.value,
  })

  const applyTransform = (next: CropTransform) => {
    const clamped = clampCropTransform(next, {
      imageWidth,
      imageHeight,
      frameWidth,
      frameHeight,
      minZoom,
      maxZoom,
    })
    translateX.value = clamped.x
    translateY.value = clamped.y
    scale.value = clamped.scale
    onTransformChange?.(clamped)
  }

  useImperativeHandle(ref, () => ({
    getTransform: readTransform,
    setTransform: applyTransform,
  }))

  useEffect(() => {
    imageW.value = imageWidth
    imageH.value = imageHeight
    frameW.value = frameWidth
    frameH.value = frameHeight
    minScale.value = minZoom
    maxScale.value = maxZoom
  }, [
    frameH,
    frameHeight,
    frameW,
    frameWidth,
    imageH,
    imageHeight,
    imageW,
    imageWidth,
    maxScale,
    maxZoom,
    minScale,
    minZoom,
  ])

  useEffect(() => {
    applyTransform({ x: 0, y: 0, scale: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri])

  // Re-clamp when the frame or fitted image size changes.
  useEffect(() => {
    applyTransform(readTransform())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameHeight, frameWidth, imageHeight, imageWidth])

  const notify = (next: CropTransform) => {
    onTransformChange?.(next)
  }

  const pan = Gesture.Pan()
    .onBegin(() => {
      'worklet'
      startX.value = translateX.value
      startY.value = translateY.value
    })
    .onUpdate((event) => {
      'worklet'
      const maxX = Math.max(0, (imageW.value * scale.value - frameW.value) / 2)
      const maxY = Math.max(0, (imageH.value * scale.value - frameH.value) / 2)
      translateX.value = Math.min(maxX, Math.max(-maxX, startX.value + event.translationX))
      translateY.value = Math.min(maxY, Math.max(-maxY, startY.value + event.translationY))
    })
    .onEnd(() => {
      'worklet'
      runOnJS(notify)({ x: translateX.value, y: translateY.value, scale: scale.value })
    })

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      'worklet'
      startScale.value = scale.value
      startX.value = translateX.value
      startY.value = translateY.value
    })
    .onUpdate((event) => {
      'worklet'
      const nextScale = Math.min(
        maxScale.value,
        Math.max(minScale.value, startScale.value * event.scale),
      )
      scale.value = nextScale
      const maxX = Math.max(0, (imageW.value * nextScale - frameW.value) / 2)
      const maxY = Math.max(0, (imageH.value * nextScale - frameH.value) / 2)
      translateX.value = Math.min(maxX, Math.max(-maxX, startX.value))
      translateY.value = Math.min(maxY, Math.max(-maxY, startY.value))
    })
    .onEnd(() => {
      'worklet'
      runOnJS(notify)({ x: translateX.value, y: translateY.value, scale: scale.value })
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <View style={[StyleSheet.absoluteFill, styles.stage]}>
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <Animated.View
          style={[{ width: imageWidth, height: imageHeight }, animatedStyle]}
        >
          <Image src={uri} width="100%" height="100%" objectFit="cover" alt="" />
        </Animated.View>
      </GestureDetector>
    </View>
  )
})

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
})
