import { useCallback, useState, useMemo, memo } from 'react'
import { Platform } from 'react-native'

import { Icons, Image, YStack } from '~/components/ui'
import type { ListingMediaKind } from '~/commerce/lib/listing-media'
import {
  getListingImageUrl,
  getListingImageFallbackUrl,
  LISTING_IMAGE_PLACEHOLDER,
  markListingImageBroken,
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
}: ListingMediaPreviewProps) {
  const ui = useAppUi()

  // console.log('📥 [ListingMediaPreview] INPUT URL:', {
  //   url,
  //   kind,
  //   alt,
  //   urlType: typeof url,
  //   urlLength: url?.length,
  // })

  // ─── Use useMemo to cache resolved URLs ─────────────────────────────
  const { resolvedUrl, fallbackUrl, isProxy } = useMemo(() => {
    const resolved = getListingImageUrl(url)
    const fallback = getListingImageFallbackUrl(url)
    const proxy = resolved?.includes('/functions/v1/image-proxy')
    
    // console.log('🧩 [ListingMediaPreview] RESOLVED:', {
    //   rawUrl: url,
    //   resolvedUrl: resolved,
    //   fallbackUrl: fallback,
    //   kind,
    //   isProxy: proxy,
    //   isIbbCo: url?.includes('ibb.co'),
    //   isIbbPage: url?.match(/^https?:\/\/ibb\.co\/[A-Za-z0-9]+$/) !== null,
    //   isIbbDirect: url?.match(/^https?:\/\/i\.ibb\.co\//) !== null,
    // })
    
    return { resolvedUrl: resolved, fallbackUrl: fallback, isProxy: proxy }
  }, [url, kind])

  // Only initialize state once with useMemo
  const [currentSrc, setCurrentSrc] = useState(resolvedUrl)
  const [triedFallback, setTriedFallback] = useState(false)

  // console.log('🖼️ [Render Image] CURRENT SRC:', {
  //   currentSrc,
  //   triedFallback,
  //   isProxy: currentSrc?.includes('/functions/v1/image-proxy'),
  //   renderUrl: currentSrc,
  //   urlDomain: currentSrc ? new URL(currentSrc).hostname : 'none',
  //   urlPath: currentSrc ? new URL(currentSrc).pathname : 'none',
  // })

  const handleImageError = useCallback(() => {
    // Keep error logs
    console.log('❌ Image failed:', {
      currentSrc,
      fallbackUrl,
      triedFallback,
      isProxy: currentSrc?.includes('/functions/v1/image-proxy'),
    })

    if (!triedFallback && fallbackUrl !== LISTING_IMAGE_PLACEHOLDER) {
      console.log('🔁 Switching to fallback')
      setTriedFallback(true)
      setCurrentSrc(fallbackUrl)
    } else {
      console.log('🛑 Using placeholder')
      markListingImageBroken(url)
      setCurrentSrc(LISTING_IMAGE_PLACEHOLDER)
    }
  }, [triedFallback, fallbackUrl, url])

  if (!url) {
    // Keep this error case log
    console.log('🚫 [ListingMediaPreview] No URL provided')
    return <ImagePlaceholder ui={ui} size={placeholderIconSize} />
  }

  if (kind === 'video' && Platform.OS === 'web') {
    // console.log('🎬 [Video Render]', { currentSrc, muted, controls })
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
    // console.log('🖼️ [Web Image Render]', {
    //   currentSrc,
    //   isProxy: currentSrc?.includes('/functions/v1/image-proxy'),
    //   objectFit,
    //   imgSrc: currentSrc,
    //   isValidUrl: currentSrc ? currentSrc.startsWith('http') || currentSrc.startsWith('data:') : false,
    // })
    return (
      <img
        src={currentSrc}
        alt={alt}
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

  // ── Native: Expo Image handles fallback natively ──
  // console.log('📱 [Native Image Render]', {
  //   currentSrc,
  //   isProxy: currentSrc?.includes('/functions/v1/image-proxy'),
  //   objectFit,
  // })
  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      objectFit={objectFit}
      onError={handleImageError}
    />
  )
})

// ─── Internal placeholder ─────────────────────────────────────────────────────

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