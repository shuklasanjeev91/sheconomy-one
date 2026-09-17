import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native'
import Svg, { Circle, Defs, Mask, Rect as SvgRect } from 'react-native-svg'

import { CropStage } from '~/components/media/CropStage'
import {
  Button,
  Icons,
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
import type { CropStageHandle, CropTransform } from '~/lib/media/crop-stage'
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

const MIN_ZOOM = 1
const MAX_ZOOM = 4
/** Above InstantMeetingHost (90_000) and AppBottomSheet (100_000). */
const CROP_Z_INDEX = 200_000
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

  const stageRef = useRef<CropStageHandle | null>(null)
  const transformRef = useRef<CropTransform>({ x: 0, y: 0, scale: 1 })

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

  const handleTransformChange = useCallback((next: CropTransform) => {
    transformRef.current = next
    setZoomLabel((prev) => (Math.abs(prev - next.scale) < 0.001 ? prev : next.scale))
  }, [])

  const resetTransform = useCallback(() => {
    transformRef.current = { x: 0, y: 0, scale: 1 }
    setZoomLabel(1)
    stageRef.current?.setTransform({ x: 0, y: 0, scale: 1 })
  }, [])

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

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (width <= 0 || height <= 0) return
    setViewport((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height },
    )
  }, [])

  function currentScale() {
    return (stageRef.current?.getTransform() ?? transformRef.current).scale
  }

  function setZoom(next: number) {
    const current = stageRef.current?.getTransform() ?? transformRef.current
    stageRef.current?.setTransform({ ...current, scale: next })
  }

  function computeCropRect(): CropRect | null {
    if (!sourceSize || !fitted) return null
    const { x, y, scale: liveScale } = stageRef.current?.getTransform() ?? transformRef.current
    const displayW = fitted.width * liveScale
    const displayH = fitted.height * liveScale

    // Image and crop frame are both centered in the stage, so the offset between
    // them only depends on their sizes and the current translation.
    const relX = ((displayW - frame.width) / 2 - x) / displayW
    const relY = ((displayH - frame.height) / 2 - y) / displayH
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

  const handleConfirm = useCallback(async () => {
    if (!image || busy) return
    setBusy(true)
    setError(null)
    try {
      const crop = computeCropRect()
      if (!crop) throw new Error('Could not crop this image.')
      const result = await cropPickedImage(image, crop)
      // Resolve the pending picker only after the cropped file is fully ready.
      // The host closes this sheet and ImageUploadField then receives the new preview.
      onConfirm(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop this image.')
      setBusy(false)
    }
  }, [aspect, busy, fitted, frame.height, frame.width, image, onConfirm, sourceSize])

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
        width={windowWidth}
        maxWidth={windowWidth}
        minWidth={windowWidth}
        flex={1}
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
      >
        {open ? (
          <YStack flex={1} width="100%" height="100%" backgroundColor="#050505">
            {/* LinkedIn-style top bar: Cancel · title · spacer */}
            <XStack
              flexShrink={0}
              minHeight={64}
              paddingTop={Math.max(safeTop, Platform.OS === 'web' ? 16 : 8)}
              paddingHorizontal={16}
              paddingBottom={10}
              alignItems="center"
              justifyContent="space-between"
              gap={12}
              backgroundColor="#111"
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderBottomColor="rgba(255,255,255,0.12)"
              zIndex={3}
            >
              <Pressable
                onPress={onCancel}
                disabled={busy}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.closeButton}
              >
                <Icons.X size={22} color="rgba(255,255,255,0.92)" />
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

              {/* Balance the close button so the title stays centered */}
              <View style={{ minWidth: 40 }} />
            </XStack>

            {/* Full-bleed stage — always opaque so app chrome never shows through
                the crop-frame hole (iPad Minimize bug: commerce under crop UI). */}
            <YStack
              flex={1}
              minHeight={220}
              width="100%"
              backgroundColor="#000"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
              onLayout={onViewportLayout}
            >
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]}
              />
              {fitted && image ? (
                <CropStage
                  ref={stageRef}
                  uri={image.uri}
                  imageWidth={fitted.width}
                  imageHeight={fitted.height}
                  frameWidth={frame.width}
                  frameHeight={frame.height}
                  minZoom={MIN_ZOOM}
                  maxZoom={MAX_ZOOM}
                  onTransformChange={handleTransformChange}
                />
              ) : error ? (
                <YStack gap="$3" padding="$4" alignItems="center" maxWidth={360}>
                  <Text fontSize={15} color="#ff8a8a" textAlign="center">
                    {error}
                  </Text>
                  <Button tone="outline" borderRadius={999} onPress={onCancel}>
                    Close
                  </Button>
                </YStack>
              ) : (
                <Spinner size="large" color="white" />
              )}

              {/* Dim outside the crop window only after the photo is on stage. */}
              {fitted && image && viewport.width > 0 && viewport.height > 0 ? (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Svg width={viewport.width} height={viewport.height}>
                    <Defs>
                      <Mask
                        id={maskId}
                        x={0}
                        y={0}
                        width={viewport.width}
                        height={viewport.height}
                        maskUnits="userSpaceOnUse"
                        maskContentUnits="userSpaceOnUse"
                      >
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
                      fill="rgba(0,0,0,0.72)"
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
              flexShrink={0}
              paddingHorizontal={20}
              paddingTop={14}
              paddingBottom={Math.max(safeBottom, 18)}
              gap={14}
              backgroundColor="#111"
              borderTopWidth={StyleSheet.hairlineWidth}
              borderTopColor="rgba(255,255,255,0.12)"
              zIndex={3}
            >
              <Text fontSize={13} color="rgba(255,255,255,0.55)" textAlign="center">
                Drag to reposition
                {Platform.OS !== 'web' ? ' · Pinch to zoom' : ' · Scroll to zoom'}
              </Text>

              <XStack alignItems="center" gap={14} width="100%">
                <Pressable
                  accessibilityLabel="Zoom out"
                  onPress={() => setZoom(currentScale() - 0.12)}
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
                  onPress={() => setZoom(currentScale() + 0.12)}
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
                onPress={handleConfirm}
                borderRadius={24}
                accessibilityLabel={busy ? 'Saving cropped photo' : 'Use cropped photo'}
              >
                {busy ? 'Preparing photo…' : 'Use this photo'}
              </Button>
            </YStack>
          </YStack>
        ) : null}
      </SheetFrame>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  zoomChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
})
