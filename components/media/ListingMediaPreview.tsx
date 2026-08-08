import { useCallback, useEffect, useMemo, useState, memo } from 'react'
import { Platform } from 'react-native'

import { Icons, Image, YStack } from '~/components/ui'
import type { ListingMediaKind } from '~/commerce/lib/listing-media'
import {
  getListingImageUrl,
  getListingImageFallbackUrl,
  LISTING_IMAGE_PLACEHOLDER,
  markListingImageBroken,
  type ListingImageDisplaySize,
} from '~/commerce/lib/images/listing-image-url'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingMediaPreviewProps = {
  url: string
  kind: ListingMediaKind
  alt: string
  width?: number | string
  height?: number | string
  objectFit?: 'cover' | 'contain' | 'fill'
  placeholderIconSize?: number
  muted?: boolean
  controls?: boolean
  /** When set, Supabase images are resized via the render API (faster cards). */
  displaySize?: ListingImageDisplaySize | null
}

/** Listing gallery tile — photo or inline video preview. */
export const ListingMediaPreview = memo(function ListingMediaPreview({
  url,
  kind,
  alt,
  width = '100%',
  height = '100%',
  objectFit = 'cover',
  placeholderIconSize = 28,
  muted = true,
  controls = false,
  displaySize = null,
}: ListingMediaPreviewProps) {
  const ui = useAppUi()

  const { resolvedUrl, fallbackUrl } = useMemo(() => {
    const resolved = getListingImageUrl(url, undefined, displaySize)
    const fallback = getListingImageFallbackUrl(url, displaySize)
    return { resolvedUrl: resolved, fallbackUrl: fallback }
  }, [url, displaySize])

  const [currentSrc, setCurrentSrc] = useState(resolvedUrl)
  const [triedFallback, setTriedFallback] = useState(false)

  // Keep src in sync when FlashList recycles the cell or size/url changes.
  useEffect(() => {
    setCurrentSrc(resolvedUrl)
    setTriedFallback(false)
  }, [resolvedUrl])

  const handleImageError = useCallback(() => {
    if (!triedFallback && fallbackUrl !== LISTING_IMAGE_PLACEHOLDER && fallbackUrl !== currentSrc) {
      setTriedFallback(true)
      setCurrentSrc(fallbackUrl)
      return
    }
    markListingImageBroken(url)
    setCurrentSrc(LISTING_IMAGE_PLACEHOLDER)
  }, [triedFallback, fallbackUrl, url, currentSrc])

  if (!url) {
    return <ImagePlaceholder ui={ui} size={placeholderIconSize} />
  }

  if (kind === 'video' && Platform.OS === 'web') {
    return (
      <video
        src={currentSrc}
        aria-label={alt}
        muted={muted}
        controls={controls}
        playsInline
        loop={!controls}
        style={{
          width: typeof width === 'number' ? width : '100%',
          height: typeof height === 'number' ? height : '100%',
          objectFit,
          background: '#000',
        }}
      />
    )
  }

  if (kind === 'video') {
    return (
      <YStack
        flex={1}
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="center"
        backgroundColor="#111"
      >
        <Icons.Video size={Math.max(placeholderIconSize, 24)} color="white" />
      </YStack>
    )
  }

  // ── Web: use <img> so we get native onError fallback chaining ──
  if (Platform.OS === 'web') {
    return (
      <img
        src={currentSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={handleImageError}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          objectFit,
          display: 'block',
        }}
      />
    )
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      objectFit={objectFit}
      recyclingKey={currentSrc}
      onError={handleImageError}
    />
  )
})

function ImagePlaceholder({ ui, size }: { ui: ReturnType<typeof useAppUi>; size: number }) {
  return (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
      backgroundColor={ui.roseSurface}
    >
      <Icons.Image size={size} color={ui.brand} opacity={0.7} />
    </YStack>
  )
}
