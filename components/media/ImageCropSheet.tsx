import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import {
  AppBottomSheet,
  Button,
  Image,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { aspectLabel, type AspectRatioTuple } from '~/lib/media/aspect'
import {
  centeredCropRect,
  cropPickedImage,
  getImageSize,
  type CropRect,
} from '~/lib/media/crop-image'
import type { PickedImage } from '~/lib/media/pick-image'
import { useAppUi } from '~/lib/theme/useAppUi'

type ImageCropSheetProps = {
  open: boolean
  image: PickedImage | null
  aspect: AspectRatioTuple | null
  title?: string
  onCancel: () => void
  onConfirm: (image: PickedImage) => void
}

type Viewport = { width: number; height: number }

/**
 * Cross-platform crop sheet: pan + zoom the image under a fixed aspect frame,
 * then crop with canvas (web) or expo-image-manipulator (native).
 */
export function ImageCropSheet({
  open,
  image,
  aspect,
  title,
  onCancel,
  onConfirm,
}: ImageCropSheetProps) {
  const ui = useAppUi()
  const { width: windowWidth } = useWindowDimensions()
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ width: Math.min(windowWidth - 48, 420), height: 360 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const scale = useSharedValue(1)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const startScale = useSharedValue(1)
  const valuesRef = useRef({ x: 0, y: 0, scale: 1 })

  const frame = useMemo(() => {
    const maxW = Math.max(240, viewport.width)
    const maxH = Math.max(240, viewport.height)
    if (!aspect) {
      return { width: maxW * 0.92, height: maxH * 0.72 }
    }
    const [aw, ah] = aspect
    const ratio = aw / ah
    let width = maxW * 0.92
    let height = width / ratio
    if (height > maxH * 0.78) {
      height = maxH * 0.78
      width = height * ratio
    }
    return { width, height }
  }, [aspect, viewport.height, viewport.width])

  const fitted = useMemo(() => {
    if (!sourceSize) return null
    const coverScale = Math.max(frame.width / sourceSize.width, frame.height / sourceSize.height)
    return {
      width: sourceSize.width * coverScale,
      height: sourceSize.height * coverScale,
      coverScale,
    }
  }, [frame.height, frame.width, sourceSize])

  useEffect(() => {
    if (!open || !image) {
      setSourceSize(null)
      setError(null)
      setBusy(false)
      return
    }
    let active = true
    setError(null)
    void getImageSize(image.uri)
      .then((size) => {
        if (!active) return
        setSourceSize(size)
        translateX.value = 0
        translateY.value = 0
        scale.value = 1
        valuesRef.current = { x: 0, y: 0, scale: 1 }
      })
      .catch(() => {
        if (!active) return
        setError('Could not load this image for cropping.')
      })
    return () => {
      active = false
    }
  }, [image, open, scale, translateX, translateY])

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = translateX.value
      startY.value = translateY.value
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX
      translateY.value = startY.value + event.translationY
    })
    .onEnd(() => {
      valuesRef.current = {
        x: translateX.value,
        y: translateY.value,
        scale: scale.value,
      }
    })

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value
    })
    .onUpdate((event) => {
      const next = Math.min(4, Math.max(1, startScale.value * event.scale))
      scale.value = next
    })
    .onEnd(() => {
      valuesRef.current = {
        x: translateX.value,
        y: translateY.value,
        scale: scale.value,
      }
    })

  const composed = Gesture.Simultaneous(pan, pinch)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (width > 0 && height > 0) setViewport({ width, height })
  }, [])

  function zoomBy(delta: number) {
    const next = Math.min(4, Math.max(1, valuesRef.current.scale + delta))
    scale.value = next
    valuesRef.current = { ...valuesRef.current, scale: next }
  }

  function computeCropRect(): CropRect | null {
    if (!sourceSize || !fitted) return null
    const { x, y, scale: liveScale } = valuesRef.current
    const displayW = fitted.width * liveScale
    const displayH = fitted.height * liveScale
    const imageLeft = (viewport.width - displayW) / 2 + x
    const imageTop = (viewport.height - displayH) / 2 + y
    const frameLeft = (viewport.width - frame.width) / 2
    const frameTop = (viewport.height - frame.height) / 2

    const relX = (frameLeft - imageLeft) / displayW
    const relY = (frameTop - imageTop) / displayH
    const relW = frame.width / displayW
    const relH = frame.height / displayH

    let originX = Math.round(relX * sourceSize.width)
    let originY = Math.round(relY * sourceSize.height)
    let width = Math.round(relW * sourceSize.width)
    let height = Math.round(relH * sourceSize.height)

    originX = Math.max(0, Math.min(originX, sourceSize.width - 1))
    originY = Math.max(0, Math.min(originY, sourceSize.height - 1))
    width = Math.max(1, Math.min(width, sourceSize.width - originX))
    height = Math.max(1, Math.min(height, sourceSize.height - originY))

    if (aspect) {
      const target = aspect[0] / aspect[1]
      const current = width / height
      if (Math.abs(current - target) > 0.02) {
        return centeredCropRect(sourceSize.width, sourceSize.height, aspect)
      }
    }

    return { originX, originY, width, height }
  }

  async function handleConfirm() {
    if (!image || busy) return
    setBusy(true)
    setError(null)
    try {
      valuesRef.current = {
        x: translateX.value,
        y: translateY.value,
        scale: scale.value,
      }
      const crop =
        computeCropRect() ??
        (sourceSize && aspect
          ? centeredCropRect(sourceSize.width, sourceSize.height, aspect)
          : sourceSize
            ? { originX: 0, originY: 0, width: sourceSize.width, height: sourceSize.height }
            : null)
      if (!crop) throw new Error('Could not crop this image.')
      const result = await cropPickedImage(image, crop)
      onConfirm(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop this image.')
    } finally {
      setBusy(false)
    }
  }

  const ratioHint = aspectLabel(aspect)

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
      title={title ?? (ratioHint ? `Crop · ${ratioHint}` : 'Crop photo')}
      scrollable={false}
      footer={
        <XStack gap="$2" width="100%">
          <Button flex={1} tone="ghost" size="$4" disabled={busy} onPress={onCancel}>
            Cancel
          </Button>
          <Button flex={1} tone="primary" size="$4" disabled={busy || !image} onPress={() => void handleConfirm()}>
            {busy ? 'Cropping…' : 'Use photo'}
          </Button>
        </XStack>
      }
    >
      <YStack gap="$3" width="100%">
        <Text fontSize={13} color={ui.textMuted}>
          Drag to reposition{Platform.OS !== 'web' ? ', pinch to zoom' : ''}. Use + / − to zoom.
        </Text>

        <YStack
          width="100%"
          height={360}
          borderRadius={16}
          overflow="hidden"
          backgroundColor="#111"
          alignItems="center"
          justifyContent="center"
          onLayout={onViewportLayout}
        >
          {fitted && image ? (
            <GestureDetector gesture={composed}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: fitted.width,
                    height: fitted.height,
                  },
                  animatedStyle,
                ]}
              >
                <Image src={image.uri} width="100%" height="100%" objectFit="cover" alt="" />
              </Animated.View>
            </GestureDetector>
          ) : (
            <Spinner size="large" color="white" />
          )}

          {/* Dimmed mask + clear crop window */}
          <YStack pointerEvents="none" position="absolute" inset={0}>
            <YStack flex={1} backgroundColor="rgba(0,0,0,0.55)" />
            <XStack height={frame.height}>
              <YStack flex={1} backgroundColor="rgba(0,0,0,0.55)" />
              <YStack
                width={frame.width}
                height={frame.height}
                borderWidth={2}
                borderColor="white"
                borderRadius={aspect && aspect[0] === aspect[1] ? 999 : 8}
              />
              <YStack flex={1} backgroundColor="rgba(0,0,0,0.55)" />
            </XStack>
            <YStack flex={1} backgroundColor="rgba(0,0,0,0.55)" />
          </YStack>
        </YStack>

        <XStack gap="$2" justifyContent="center" alignItems="center">
          <Button tone="outline" size="$3" borderRadius={999} onPress={() => zoomBy(-0.15)} disabled={busy}>
            −
          </Button>
          <Text fontSize={13} color={ui.textMuted} minWidth={64} textAlign="center">
            Zoom
          </Text>
          <Button tone="outline" size="$3" borderRadius={999} onPress={() => zoomBy(0.15)} disabled={busy}>
            +
          </Button>
        </XStack>

        {error ? (
          <Text fontSize={13} color="#cc1010">
            {error}
          </Text>
        ) : null}
      </YStack>
    </AppBottomSheet>
  )
}
