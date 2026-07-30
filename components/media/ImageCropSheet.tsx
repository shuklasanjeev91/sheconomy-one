import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Mask, Rect as SvgRect } from 'react-native-svg'

import {
  Button,
  Image,
  Sheet,
  SheetFrame,
  SheetOverlay,
  Slider,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { aspectLabel, type AspectRatioTuple } from '~/lib/media/aspect'
import {
  centeredCropRect,
  cropPickedImage,
  getImageSize,
  type CropRect,
} from '~/lib/media/crop-image'
import type { CropShape } from '~/lib/media/crop-session'
import type { PickedImage } from '~/lib/media/pick-image'

type ImageCropSheetProps = {
  open: boolean
  image: PickedImage | null
  aspect: AspectRatioTuple | null
  shape?: CropShape
  title?: string
  onCancel: () => void
  onConfirm: (image: PickedImage) => void
}

type Viewport = { width: number; height: number }
type Transform = { x: number; y: number; scale: number }

const MIN_ZOOM = 1
const MAX_ZOOM = 4
/** Above AppBottomSheet (100_000) so crop appears over create-post composer. */
const CROP_Z_INDEX = 110_000
const SHEET_ANIMATION = Platform.OS === 'web' ? 'quick' : '100ms'

/**
 * LinkedIn-like fullscreen photo editor (web + native):
 * black stage, Cancel / Save photo chrome, large centered frame,
 * circular vignette for avatars, pan + pinch/slider zoom.
 */
export function ImageCropSheet({
  open,
  image,
  aspect,
  shape = 'rect',
  title,
  onCancel,
  onConfirm,
}: ImageCropSheetProps) {
  const maskId = useId().replace(/:/g, '')
  const { safeTop, safeBottom } = useAppLayout()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()

  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null)
  const [viewport, setViewport] = useState<Viewport>({
    width: windowWidth,
    height: Math.max(280, windowHeight - 220),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoomLabel, setZoomLabel] = useState(1)

  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const scale = useSharedValue(1)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const startScale = useSharedValue(1)
  const frameW = useSharedValue(0)
  const frameH = useSharedValue(0)
  const fittedW = useSharedValue(0)
  const fittedH = useSharedValue(0)
  const valuesRef = useRef<Transform>({ x: 0, y: 0, scale: 1 })

  const isCircle = shape === 'circle'

  const frame = useMemo(() => {
    // LinkedIn uses a large centered window — leave modest padding only.
    const maxW = Math.max(180, viewport.width * (isCircle ? 0.78 : 0.92))
    const maxH = Math.max(180, viewport.height * (isCircle ? 0.78 : 0.88))

    if (isCircle || (aspect && aspect[0] === aspect[1])) {
      const side = Math.min(maxW, maxH)
      return { width: side, height: side }
    }

    if (!aspect) {
      if (sourceSize && sourceSize.width > 0 && sourceSize.height > 0) {
        const imageRatio = sourceSize.width / sourceSize.height
        let width = maxW
        let height = width / imageRatio
        if (height > maxH) {
          height = maxH
          width = height * imageRatio
        }
        return { width, height }
      }
      const side = Math.min(maxW, maxH)
      return { width: side, height: side }
    }

    const [aw, ah] = aspect
    const ratio = aw / ah
    let width = maxW
    let height = width / ratio
    if (height > maxH) {
      height = maxH
      width = height * ratio
    }
    return { width, height }
  }, [aspect, isCircle, sourceSize, viewport.height, viewport.width])

  const fitted = useMemo(() => {
    if (!sourceSize) return null
    const coverScale = Math.max(frame.width / sourceSize.width, frame.height / sourceSize.height)
    return {
      width: sourceSize.width * coverScale,
      height: sourceSize.height * coverScale,
    }
  }, [frame.height, frame.width, sourceSize])

  useEffect(() => {
    frameW.value = frame.width
    frameH.value = frame.height
    fittedW.value = fitted?.width ?? 0
    fittedH.value = fitted?.height ?? 0
  }, [fitted?.height, fitted?.width, fittedH, fittedW, frame.height, frame.width, frameH, frameW])

  const syncTransform = useCallback((next: Transform) => {
    valuesRef.current = next
    setZoomLabel((prev) => (Math.abs(prev - next.scale) < 0.001 ? prev : next.scale))
  }, [])

  const clampTranslation = useCallback(
    (x: number, y: number, liveScale: number) => {
      if (!fitted) return { x: 0, y: 0 }
      const displayW = fitted.width * liveScale
      const displayH = fitted.height * liveScale
      const maxX = Math.max(0, (displayW - frame.width) / 2)
      const maxY = Math.max(0, (displayH - frame.height) / 2)
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      }
    },
    [fitted, frame.height, frame.width],
  )

  const applyTransform = useCallback(
    (x: number, y: number, liveScale: number) => {
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, liveScale))
      const clamped = clampTranslation(x, y, nextScale)
      translateX.value = clamped.x
      translateY.value = clamped.y
      scale.value = nextScale
      syncTransform({ x: clamped.x, y: clamped.y, scale: nextScale })
    },
    [clampTranslation, scale, syncTransform, translateX, translateY],
  )

  const resetTransform = useCallback(() => {
    translateX.value = 0
    translateY.value = 0
    scale.value = 1
    syncTransform({ x: 0, y: 0, scale: 1 })
  }, [scale, syncTransform, translateX, translateY])

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
        resetTransform()
      })
      .catch(() => {
        if (!active) return
        setError('Could not load this image for cropping.')
      })
    return () => {
      active = false
    }
  }, [image, open, resetTransform])

  useEffect(() => {
    if (!fitted) return
    applyTransform(valuesRef.current.x, valuesRef.current.y, valuesRef.current.scale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitted?.width, fitted?.height, frame.width, frame.height])

  useEffect(() => {
    if (!open || Platform.OS !== 'web') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = translateX.value
      startY.value = translateY.value
    })
    .onUpdate((event) => {
      'worklet'
      const nextX = startX.value + event.translationX
      const nextY = startY.value + event.translationY
      const displayW = fittedW.value * scale.value
      const displayH = fittedH.value * scale.value
      const maxX = Math.max(0, (displayW - frameW.value) / 2)
      const maxY = Math.max(0, (displayH - frameH.value) / 2)
      translateX.value = Math.min(maxX, Math.max(-maxX, nextX))
      translateY.value = Math.min(maxY, Math.max(-maxY, nextY))
    })
    .onEnd(() => {
      'worklet'
      runOnJS(syncTransform)({
        x: translateX.value,
        y: translateY.value,
        scale: scale.value,
      })
    })

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value
      startX.value = translateX.value
      startY.value = translateY.value
    })
    .onUpdate((event) => {
      'worklet'
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, startScale.value * event.scale))
      scale.value = nextScale
      const displayW = fittedW.value * nextScale
      const displayH = fittedH.value * nextScale
      const maxX = Math.max(0, (displayW - frameW.value) / 2)
      const maxY = Math.max(0, (displayH - frameH.value) / 2)
      translateX.value = Math.min(maxX, Math.max(-maxX, startX.value))
      translateY.value = Math.min(maxY, Math.max(-maxY, startY.value))
    })
    .onEnd(() => {
      'worklet'
      runOnJS(syncTransform)({
        x: translateX.value,
        y: translateY.value,
        scale: scale.value,
      })
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
    if (width <= 0 || height <= 0) return
    setViewport((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height },
    )
  }, [])

  const onWheelZoom = useCallback(
    (event: { nativeEvent?: { deltaY?: number }; deltaY?: number; preventDefault?: () => void }) => {
      const deltaY = event.nativeEvent?.deltaY ?? event.deltaY ?? 0
      event.preventDefault?.()
      applyTransform(
        valuesRef.current.x,
        valuesRef.current.y,
        valuesRef.current.scale + (deltaY > 0 ? -0.12 : 0.12),
      )
    },
    [applyTransform],
  )

  function setZoom(next: number) {
    applyTransform(valuesRef.current.x, valuesRef.current.y, next)
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
  const headerTitle =
    title ??
    (isCircle ? 'Edit photo' : ratioHint ? `Edit photo · ${ratioHint}` : 'Edit photo')
  const frameLeft = (viewport.width - frame.width) / 2
  const frameTop = (viewport.height - frame.height) / 2
  const circleR = Math.min(frame.width, frame.height) / 2
  const zoomPct = Math.round(zoomLabel * 100)

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
      modal
      dismissOnSnapToBottom={false}
      snapPoints={[100]}
      snapPointsMode="percent"
      zIndex={CROP_Z_INDEX}
      animation={SHEET_ANIMATION}
      moveOnKeyboardChange={false}
    >
      <SheetOverlay
        animation={SHEET_ANIMATION}
        backgroundColor="rgba(0,0,0,0.92)"
      />
      <SheetFrame
        padding={0}
        margin={0}
        backgroundColor="#000"
        borderTopLeftRadius={0}
        borderTopRightRadius={0}
        borderBottomLeftRadius={0}
        borderBottomRightRadius={0}
        overflow="hidden"
        height={windowHeight}
        maxHeight={windowHeight}
        minHeight={windowHeight}
        width="100%"
        flex={1}
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
      >
        {open ? (
          <YStack flex={1} width="100%" height="100%" backgroundColor="#000">
            {/* LinkedIn-style top bar: Cancel · title · spacer */}
            <XStack
              paddingTop={Math.max(safeTop, Platform.OS === 'web' ? 16 : 8)}
              paddingHorizontal={16}
              paddingBottom={10}
              alignItems="center"
              justifyContent="space-between"
              gap={12}
            >
              <Pressable
                onPress={onCancel}
                disabled={busy}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text fontSize={16} fontWeight="600" color="rgba(255,255,255,0.92)">
                  Cancel
                </Text>
              </Pressable>

              <Text
                flex={1}
                textAlign="center"
                fontSize={17}
                fontWeight="700"
                color="#fff"
                numberOfLines={1}
              >
                {headerTitle}
              </Text>

              {/* Balance Cancel width so title stays centered */}
              <View style={{ minWidth: 56 }} />
            </XStack>

            {/* Full-bleed stage */}
            <YStack
              flex={1}
              width="100%"
              backgroundColor="#000"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
              onLayout={onViewportLayout}
              // @ts-expect-error — web wheel
              onWheel={Platform.OS === 'web' ? onWheelZoom : undefined}
            >
              {fitted && image ? (
                <GestureDetector gesture={composed}>
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        width: fitted.width,
                        height: fitted.height,
                        left: (viewport.width - fitted.width) / 2,
                        top: (viewport.height - fitted.height) / 2,
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

              {/* True circular / rect vignette via SVG mask */}
              {viewport.width > 0 && viewport.height > 0 ? (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Svg width={viewport.width} height={viewport.height}>
                    <Defs>
                      <Mask id={maskId}>
                        <SvgRect width={viewport.width} height={viewport.height} fill="#fff" />
                        {isCircle ? (
                          <Circle
                            cx={viewport.width / 2}
                            cy={viewport.height / 2}
                            r={circleR}
                            fill="#000"
                          />
                        ) : (
                          <SvgRect
                            x={frameLeft}
                            y={frameTop}
                            width={frame.width}
                            height={frame.height}
                            rx={2}
                            ry={2}
                            fill="#000"
                          />
                        )}
                      </Mask>
                    </Defs>
                    <SvgRect
                      width={viewport.width}
                      height={viewport.height}
                      fill="rgba(0,0,0,0.68)"
                      mask={`url(#${maskId})`}
                    />
                    {isCircle ? (
                      <Circle
                        cx={viewport.width / 2}
                        cy={viewport.height / 2}
                        r={circleR}
                        fill="none"
                        stroke="rgba(255,255,255,0.95)"
                        strokeWidth={2.5}
                      />
                    ) : (
                      <SvgRect
                        x={frameLeft}
                        y={frameTop}
                        width={frame.width}
                        height={frame.height}
                        rx={2}
                        ry={2}
                        fill="none"
                        stroke="rgba(255,255,255,0.95)"
                        strokeWidth={2}
                      />
                    )}
                  </Svg>
                </View>
              ) : null}
            </YStack>

            {/* LinkedIn-style bottom controls */}
            <YStack
              paddingHorizontal={20}
              paddingTop={14}
              paddingBottom={Math.max(safeBottom, 18)}
              gap={14}
              backgroundColor="#000"
              borderTopWidth={StyleSheet.hairlineWidth}
              borderTopColor="rgba(255,255,255,0.12)"
            >
              <Text fontSize={13} color="rgba(255,255,255,0.55)" textAlign="center">
                Drag to reposition
                {Platform.OS !== 'web' ? ' · Pinch to zoom' : ' · Scroll to zoom'}
              </Text>

              <XStack alignItems="center" gap={14} width="100%">
                <Pressable
                  accessibilityLabel="Zoom out"
                  onPress={() => setZoom(valuesRef.current.scale - 0.12)}
                  disabled={busy || zoomLabel <= MIN_ZOOM}
                  hitSlop={8}
                  style={styles.zoomChip}
                >
                  <Text fontSize={22} color="#fff" fontWeight="500" lineHeight={24}>
                    −
                  </Text>
                </Pressable>

                <YStack flex={1} gap={6}>
                  <Slider
                    value={[zoomLabel]}
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={0.01}
                    onValueChange={(vals) => {
                      const next = vals[0]
                      if (typeof next === 'number') setZoom(next)
                    }}
                  />
                  <Text fontSize={12} color="rgba(255,255,255,0.45)" textAlign="center">
                    {zoomPct}%
                  </Text>
                </YStack>

                <Pressable
                  accessibilityLabel="Zoom in"
                  onPress={() => setZoom(valuesRef.current.scale + 0.12)}
                  disabled={busy || zoomLabel >= MAX_ZOOM}
                  hitSlop={8}
                  style={styles.zoomChip}
                >
                  <Text fontSize={22} color="#fff" fontWeight="500" lineHeight={24}>
                    +
                  </Text>
                </Pressable>
              </XStack>

              {error ? (
                <Text fontSize={13} color="#ff8a8a" textAlign="center">
                  {error}
                </Text>
              ) : null}

              <Button
                tone="primary"
                size="$5"
                width="100%"
                disabled={busy || !image}
                onPress={() => void handleConfirm()}
                borderRadius={24}
              >
                {busy ? 'Saving…' : 'Save photo'}
              </Button>
            </YStack>
          </YStack>
        ) : null}
      </SheetFrame>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  zoomChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
})
