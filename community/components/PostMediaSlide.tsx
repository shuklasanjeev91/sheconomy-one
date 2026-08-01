import { createElement, useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import type { PostMediaItem } from '~/community/lib/post-media'
import { isVideoMediaUrl } from '~/community/lib/post-media'
import { isGifUrl } from '~/community/lib/giphy'
import { AutoplayVideo } from '~/components/media/AutoplayVideo'
import { NativeVideoFile } from '~/lib/native/NativeMediaPlayers'
import { parseVideoProvider } from '~/lib/link-preview'
import {
  extractYoutubeId,
  getVideoPosterUrl,
  videoSrcWithFirstFrame,
} from '~/lib/media/video-thumbnail'
import { Icons, Image, YStack } from '~/components/ui'

type PostMediaSlideProps = {
  item: PostMediaItem
  /** Pixel width; omit or pass 0 with `fill` to stretch to parent. */
  width?: number
  height: number
  fit?: 'cover' | 'contain'
  /** Stretch to 100% of parent width (single-media cards). */
  fill?: boolean
  /** Optional poster override (e.g. companion image on the same post). */
  posterUrl?: string | null
  /**
   * Feed / rails: LinkedIn-style muted autoplay when in view.
   * Lightbox / detail can set false for explicit click-to-play with controls.
   */
  autoplayInView?: boolean
  /**
   * When true (default for contain+fill images), frame height follows the
   * media aspect ratio within [minHeight, height] so photos aren't cropped.
   */
  responsive?: boolean
}

function aspectFromLoadEvent(event: unknown): number | null {
  if (!event || typeof event !== 'object') return null
  const source =
    'source' in event
      ? (event as { source?: { width?: number; height?: number } }).source
      : 'nativeEvent' in event
        ? (event as { nativeEvent?: { source?: { width?: number; height?: number } } }).nativeEvent
            ?.source
        : null
  const w = source?.width
  const h = source?.height
  if (!w || !h || w <= 0 || h <= 0) return null
  return w / h
}

/** Renders one image or video slide for post carousels / single media. */
export function PostMediaSlide({
  item,
  width = 0,
  height,
  fit = 'contain',
  fill = false,
  posterUrl = null,
  autoplayInView = true,
  responsive,
}: PostMediaSlideProps) {
  const frameWidth = fill || !width ? '100%' : width
  const [manualPlay, setManualPlay] = useState(false)
  const { width: windowWidth } = useWindowDimensions()
  const [layoutWidth, setLayoutWidth] = useState(width > 0 ? width : windowWidth)
  const [aspect, setAspect] = useState<number | null>(null)
  const useResponsive =
    responsive ?? (fit === 'contain' && fill && item.kind !== 'video')
  const minHeight = Math.min(200, height)
  // Until natural size loads, use a moderate 4:3 frame (not the max) so
  // landscape photos don't reserve a tall empty block over the action row.
  const pendingHeight = Math.min(Math.max(Math.round(layoutWidth * 0.75), minHeight), height)
  const responsiveHeight =
    useResponsive && aspect
      ? Math.min(Math.max(Math.round(layoutWidth / aspect), minHeight), height)
      : useResponsive
        ? pendingHeight
        : height
  const frameHeight = useResponsive ? responsiveHeight : height

  const provider = parseVideoProvider(item.url)
  const isEmbedOrVideo = item.kind === 'video' || !!provider || isVideoMediaUrl(item.url)

  if (isEmbedOrVideo) {
    const poster = getVideoPosterUrl(item.url, posterUrl)
    // Prefer watch/page URL so AutoplayVideo can derive YouTube id + poster.
    const playSrc = item.url

    // Embed hosts (YouTube/Vimeo) always use the in-view autoplay player.
    if (provider || extractYoutubeId(item.url) || autoplayInView) {
      return (
        <YStack width={frameWidth} height={frameHeight} backgroundColor="#000" overflow="hidden">
          <AutoplayVideo
            src={playSrc}
            posterUrl={poster}
            height={frameHeight}
            objectFit={fit}
            autoplayInView
          />
        </YStack>
      )
    }

    if (!manualPlay) {
      return (
        <YStack
          width={frameWidth}
          height={frameHeight}
          alignItems="center"
          justifyContent="center"
          backgroundColor="#000"
          overflow="hidden"
          cursor="pointer"
          onPress={() => setManualPlay(true)}
          aria-label="Play video"
        >
          {poster ? (
            <Image src={poster} width="100%" height="100%" objectFit={fit} alt="" />
          ) : Platform.OS === 'web' ? (
            <video
              src={videoSrcWithFirstFrame(item.url)}
              muted
              playsInline
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: fit, backgroundColor: '#000' }}
            />
          ) : (
            <YStack flex={1} width="100%" height="100%" backgroundColor="#111" />
          )}
          <YStack
            position="absolute"
            width={56}
            height={56}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor="rgba(0,0,0,0.55)"
            borderWidth={1}
            borderColor="rgba(255,255,255,0.35)"
          >
            <Icons.Play size={26} color="#fff" fill="#fff" />
          </YStack>
        </YStack>
      )
    }

    if (Platform.OS === 'web') {
      return (
        <YStack
          width={frameWidth}
          height={frameHeight}
          alignItems="center"
          justifyContent="center"
          backgroundColor="#000"
        >
          {createElement('video', {
            src: videoSrcWithFirstFrame(item.url),
            controls: true,
            playsInline: true,
            autoPlay: true,
            preload: 'metadata',
            poster: poster ?? undefined,
            style: { width: '100%', height: '100%', objectFit: fit, backgroundColor: '#000' },
          })}
        </YStack>
      )
    }

    return (
      <YStack
        width={frameWidth}
        height={frameHeight}
        alignItems="center"
        justifyContent="center"
        backgroundColor="#000"
      >
        <NativeVideoFile uri={item.url} posterUri={poster} autoPlay />
      </YStack>
    )
  }

  const image = (
    <Image
      src={item.url}
      width={frameWidth}
      height={useResponsive ? '100%' : frameHeight}
      objectFit={fit}
      alt=""
      onLoad={(event) => {
        const next = aspectFromLoadEvent(event)
        if (next && next !== aspect) setAspect(next)
      }}
    />
  )

  if (useResponsive) {
    return (
      <YStack
        width={frameWidth}
        height={frameHeight}
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width
          if (next > 0 && Math.abs(next - layoutWidth) > 1) setLayoutWidth(next)
        }}
      >
        {image}
      </YStack>
    )
  }

  if (isGifUrl(item.url)) {
    return image
  }

  return image
}
