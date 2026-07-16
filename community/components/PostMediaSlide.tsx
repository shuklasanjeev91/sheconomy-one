import { createElement, useState } from 'react'
import { Platform } from 'react-native'

import type { PostMediaItem } from '~/community/lib/post-media'
import { isGifUrl } from '~/community/lib/giphy'
import { AutoplayVideo } from '~/components/media/AutoplayVideo'
import { NativeVideoFile } from '~/lib/native/NativeMediaPlayers'
import {
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
}: PostMediaSlideProps) {
  const frameWidth = fill || !width ? '100%' : width
  const [manualPlay, setManualPlay] = useState(false)

  if (item.kind === 'video') {
    const poster = getVideoPosterUrl(item.url, posterUrl)

    if (autoplayInView) {
      return (
        <YStack width={frameWidth} height={height}>
          <AutoplayVideo
            src={item.url}
            posterUrl={poster}
            height={height}
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
          height={height}
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
          height={height}
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
        height={height}
        alignItems="center"
        justifyContent="center"
        backgroundColor="#000"
      >
        <NativeVideoFile uri={item.url} posterUri={poster} autoPlay />
      </YStack>
    )
  }

  if (isGifUrl(item.url) && Platform.OS === 'web') {
    return (
      <YStack width={frameWidth} height={height} alignItems="center" justifyContent="center">
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src={item.url} style={{ width: '100%', height: '100%', objectFit: fit }} />
      </YStack>
    )
  }

  return <Image src={item.url} width={frameWidth} height={height} objectFit={fit} alt="" />
}
