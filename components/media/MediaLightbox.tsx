import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'

import { PostMediaSlide } from '~/community/components/PostMediaSlide'
import type { PostMediaItem } from '~/community/lib/post-media'
import {
  ZoomableImage,
  type ZoomableImageHandle,
} from '~/components/media/ZoomableImage'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { formatZoomPercent, IMAGE_ZOOM_MAX, IMAGE_ZOOM_MIN } from '~/lib/zoom/zoom-levels'

export type MediaLightboxItem = {
  url: string
  kind?: 'image' | 'video'
  alt?: string
}

type MediaLightboxProps = {
  items: MediaLightboxItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  initialIndex?: number
}

function toSlides(items: MediaLightboxItem[]): PostMediaItem[] {
  return items.map((item) => ({
    url: item.url,
    kind:
      item.kind ??
      (/\.(mp4|webm|mov|m4v|mkv|ogg|m3u8)(\?|$)/i.test(item.url) ? 'video' : 'image'),
  }))
}

/**
 * LinkedIn-style fullscreen media viewer with multi-step − / % / + zoom.
 */
export function MediaLightbox({ items, open, onOpenChange, initialIndex = 0 }: MediaLightboxProps) {
  const slides = toSlides(items)
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [index, setIndex] = useState(initialIndex)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [zoomed, setZoomed] = useState(false)
  const [scale, setScale] = useState(1)
  const zoomedRef = useRef(false)
  const zoomRef = useRef<ZoomableImageHandle>(null)

  useEffect(() => {
    if (!open) return
    const start = Math.max(0, Math.min(initialIndex, Math.max(0, slides.length - 1)))
    setIndex(start)
    setChromeVisible(true)
    setZoomed(false)
    setScale(1)
    zoomedRef.current = false
  }, [open, initialIndex, slides.length])

  const onZoomChange = useCallback((isZoomed: boolean) => {
    zoomedRef.current = isZoomed
    setZoomed(isZoomed)
  }, [])

  const goTo = useCallback(
    (next: number) => {
      if (zoomedRef.current) return
      const clamped = Math.max(0, Math.min(next, slides.length - 1))
      setIndex(clamped)
      setZoomed(false)
      setScale(1)
      zoomedRef.current = false
    },
    [slides.length],
  )

  useEffect(() => {
    if (!open || Platform.OS !== 'web') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
        return
      }
      if (event.key === '=' || event.key === '+') {
        event.preventDefault()
        zoomRef.current?.zoomIn()
        return
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        zoomRef.current?.zoomOut()
        return
      }
      if (event.key === '0') {
        zoomRef.current?.reset()
        return
      }
      if (zoomedRef.current) return
      if (event.key === 'ArrowLeft') goTo(index - 1)
      if (event.key === 'ArrowRight') goTo(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange, goTo, index])

  if (!slides.length) return null

  const slide = slides[index]
  const safeAreaTop = Platform.OS === 'ios' ? 54 : Platform.OS === 'android' ? 28 : 16
  const canZoomIn = scale < IMAGE_ZOOM_MAX - 0.02
  const canZoomOut = scale > IMAGE_ZOOM_MIN + 0.02

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => onOpenChange(false)}
      presentationStyle="overFullScreen"
    >
      <View style={styles.root} accessibilityViewIsModal>
        <View style={[styles.stage, { width: windowWidth, height: windowHeight }]}>
          {slide?.kind === 'image' ? (
            <ZoomableImage
              key={`${slide.url}-${index}`}
              ref={zoomRef}
              uri={slide.url}
              alt={items[index]?.alt ?? ''}
              onZoomChange={onZoomChange}
              onScaleChange={setScale}
              onTap={() => setChromeVisible((v) => !v)}
              onSwipeLeft={() => goTo(index + 1)}
              onSwipeRight={() => goTo(index - 1)}
            />
          ) : slide ? (
            <PostMediaSlide
              item={slide}
              width={windowWidth}
              height={windowHeight}
              fit="contain"
              autoplayInView={false}
            />
          ) : null}
        </View>

        {chromeVisible ? (
          <XStack
            position="absolute"
            top={safeAreaTop}
            left={16}
            right={16}
            zIndex={30}
            alignItems="center"
            justifyContent="space-between"
            pointerEvents="box-none"
          >
            <YStack width={44} />
            {slides.length > 1 ? (
              <Text fontSize={15} fontWeight="700" color="rgba(255,255,255,0.95)">
                {index + 1} / {slides.length}
              </Text>
            ) : (
              <YStack />
            )}
            <Pressable
              onPress={() => onOpenChange(false)}
              accessibilityLabel="Close"
              style={styles.chromeBtn}
            >
              <Icons.X size={22} color="white" />
            </Pressable>
          </XStack>
        ) : null}

        {chromeVisible && slide?.kind === 'image' ? (
          <XStack
            position="absolute"
            bottom={Platform.OS === 'web' ? 28 : 48}
            alignSelf="center"
            left={0}
            right={0}
            justifyContent="center"
            zIndex={30}
            pointerEvents="box-none"
          >
            <XStack
              gap={4}
              alignItems="center"
              paddingHorizontal={8}
              paddingVertical={6}
              borderRadius={999}
              backgroundColor="rgba(0,0,0,0.65)"
            >
              <Pressable
                onPress={() => zoomRef.current?.zoomOut()}
                disabled={!canZoomOut}
                accessibilityLabel="Zoom out"
                style={[styles.zoomBtn, { opacity: canZoomOut ? 1 : 0.35 }]}
              >
                <Text color="#fff" fontSize={22} fontWeight="700">
                  −
                </Text>
              </Pressable>
              <Pressable
                onPress={() => zoomRef.current?.reset()}
                accessibilityLabel={`Zoom ${formatZoomPercent(scale)}, reset`}
                style={styles.zoomLabel}
              >
                <Text color="#fff" fontSize={13} fontWeight="700">
                  {formatZoomPercent(scale)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => zoomRef.current?.zoomIn()}
                disabled={!canZoomIn}
                accessibilityLabel="Zoom in"
                style={[styles.zoomBtn, { opacity: canZoomIn ? 1 : 0.35 }]}
              >
                <Text color="#fff" fontSize={22} fontWeight="700">
                  +
                </Text>
              </Pressable>
            </XStack>
          </XStack>
        ) : null}

        {chromeVisible && slides.length > 1 && !zoomed ? (
          <>
            {index > 0 ? (
              <Pressable
                onPress={() => goTo(index - 1)}
                accessibilityLabel="Previous"
                style={[styles.sideArrow, styles.sideLeft]}
              >
                <Icons.ChevronLeft size={28} color="white" />
              </Pressable>
            ) : null}
            {index < slides.length - 1 ? (
              <Pressable
                onPress={() => goTo(index + 1)}
                accessibilityLabel="Next"
                style={[styles.sideArrow, styles.sideRight]}
              >
                <Icons.ChevronRight size={28} color="white" />
              </Pressable>
            ) : null}
          </>
        ) : null}

        {chromeVisible && slides.length > 1 && slide?.kind !== 'image' ? (
          <XStack
            position="absolute"
            bottom={Platform.OS === 'web' ? 28 : 40}
            left={0}
            right={0}
            justifyContent="center"
            gap={6}
            pointerEvents="none"
            zIndex={30}
          >
            {slides.map((s, i) => (
              <YStack
                key={`dot-${s.url}-${i}`}
                width={i === index ? 18 : 6}
                height={6}
                borderRadius={999}
                backgroundColor={i === index ? '#fff' : 'rgba(255,255,255,0.35)'}
              />
            ))}
          </XStack>
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
  },
  stage: {
    flex: 1,
    backgroundColor: '#000',
  },
  chromeBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  zoomBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  zoomLabel: {
    minWidth: 52,
    alignItems: 'center',
    paddingVertical: 6,
  },
  sideArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    zIndex: 30,
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sideLeft: {
    left: 12,
  },
  sideRight: {
    right: 12,
  },
})
