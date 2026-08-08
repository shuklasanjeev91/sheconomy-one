import { useEffect, useState, useMemo, memo, useRef } from 'react'
import { Icons, YStack } from '~/components/ui'
import { ListingMediaPreview } from '~/components/media/ListingMediaPreview'
import { listingMediaKind } from '~/commerce/lib/listing-media'
import {
  LISTING_CARD_IMAGE_EDGE,
  type ListingImageDisplaySize,
} from '~/commerce/lib/images/listing-image-url'
import { getListingImageUrls } from '~/lib/listing-images'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingImageProps = {
  imageUrls?: string[] | null
  fallbackUrl?: string | null
  imageType?: string | null
  alt: string
  width?: number | string
  height?: number | string
  objectFit?: 'cover' | 'contain' | 'fill'
  placeholderIconSize?: number
  /**
   * Pixel size for Supabase image transforms. Defaults from numeric width/height,
   * otherwise {@link LISTING_CARD_IMAGE_EDGE} for fluid card tiles.
   */
  displaySize?: ListingImageDisplaySize | null
}

function arePropsEqual(prev: ListingImageProps, next: ListingImageProps): boolean {
  const prevUrls = prev.imageUrls?.join('|') ?? ''
  const nextUrls = next.imageUrls?.join('|') ?? ''
  if (prevUrls !== nextUrls) return false

  return (
    prev.fallbackUrl === next.fallbackUrl &&
    prev.imageType === next.imageType &&
    prev.alt === next.alt &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.objectFit === next.objectFit &&
    prev.placeholderIconSize === next.placeholderIconSize &&
    prev.displaySize?.width === next.displaySize?.width &&
    prev.displaySize?.height === next.displaySize?.height &&
    prev.displaySize?.quality === next.displaySize?.quality &&
    prev.displaySize?.resize === next.displaySize?.resize
  )
}

function resolveDisplaySize(
  width: number | string | undefined,
  height: number | string | undefined,
  displaySize: ListingImageDisplaySize | null | undefined,
): ListingImageDisplaySize {
  if (displaySize?.width || displaySize?.height) {
    return {
      width: displaySize.width,
      height: displaySize.height,
      quality: displaySize.quality ?? 72,
      resize: displaySize.resize ?? 'cover',
    }
  }

  const w = typeof width === 'number' && width > 0 ? Math.round(width * 2) : undefined
  const h = typeof height === 'number' && height > 0 ? Math.round(height * 2) : undefined
  if (w || h) {
    return { width: w ?? h, height: h ?? w, quality: 72, resize: 'cover' }
  }

  return {
    width: LISTING_CARD_IMAGE_EDGE,
    height: LISTING_CARD_IMAGE_EDGE,
    quality: 72,
    resize: 'cover',
  }
}

export const ListingImage = memo(function ListingImage({
  imageUrls,
  fallbackUrl,
  imageType,
  alt,
  width = '100%',
  height = '100%',
  objectFit = 'cover',
  placeholderIconSize = 28,
  displaySize,
}: ListingImageProps) {
  const ui = useAppUi()

  const urls = useMemo(() => getListingImageUrls(imageUrls, fallbackUrl), [imageUrls, fallbackUrl])
  const [activeIndex, setActiveIndex] = useState(0)
  const [failed, setFailed] = useState(false)

  const urlsKey = useMemo(() => urls.join('|'), [urls])
  const prevUrlsKeyRef = useRef<string>(urlsKey)

  const src = useMemo(() => urls[activeIndex] ?? null, [urls, activeIndex])
  const kind = useMemo(() => (src ? listingMediaKind(src, imageType) : 'image'), [src, imageType])
  const resolvedDisplaySize = useMemo(
    () => resolveDisplaySize(width, height, displaySize),
    [width, height, displaySize],
  )

  useEffect(() => {
    if (prevUrlsKeyRef.current !== urlsKey) {
      setActiveIndex(0)
      setFailed(false)
      prevUrlsKeyRef.current = urlsKey
    }
  }, [urlsKey])

  if (!src || failed) {
    return (
      <YStack
        flex={1}
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.roseSurface}
      >
        <Icons.Image size={placeholderIconSize} color={ui.brand} opacity={0.7} />
      </YStack>
    )
  }

  return (
    <ListingMediaPreview
      url={src}
      kind={kind}
      alt={alt}
      width={width}
      height={height}
      objectFit={objectFit}
      placeholderIconSize={placeholderIconSize}
      muted={true}
      controls={false}
      displaySize={resolvedDisplaySize}
    />
  )
}, arePropsEqual)
