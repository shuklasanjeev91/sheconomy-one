import { Platform } from 'react-native'

import type { PostMediaItem } from '~/community/lib/post-media'
import { isGifUrl } from '~/community/lib/giphy'
import { NativeVideoFile } from '~/lib/native/NativeMediaPlayers'
import { Image, YStack } from '~/components/ui'

type PostMediaSlideProps = {
  item: PostMediaItem
  /** Pixel width; omit or pass 0 with `fill` to stretch to parent. */
  width?: number
  height: number
  fit?: 'cover' | 'contain'
  /** Stretch to 100% of parent width (single-media cards). */
  fill?: boolean
}

/** Renders one image or video slide for post carousels / single media. */
export function PostMediaSlide({
  item,
  width = 0,
  height,
  fit = 'contain',
  fill = false,
}: PostMediaSlideProps) {
  const frameWidth = fill || !width ? '100%' : width

  if (item.kind === 'video') {
    if (Platform.OS === 'web') {
      return (
        <YStack width={frameWidth} height={height} alignItems="center" justifyContent="center" backgroundColor="#000">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={item.url}
            controls
            playsInline
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: fit, backgroundColor: '#000' }}
          />
        </YStack>
      )
    }
    return (
      <YStack width={frameWidth} height={height} alignItems="center" justifyContent="center" backgroundColor="#000">
        <NativeVideoFile uri={item.url} />
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
