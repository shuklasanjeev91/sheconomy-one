import { useEffect, useState, useMemo, memo, useRef } from 'react'
import { Icons, Image, YStack } from '~/components/ui'
import { ListingMediaPreview } from '~/components/media/ListingMediaPreview'
import { listingMediaKind } from '~/commerce/lib/listing-media'
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
}

// ─── Custom equality check for memo ──────────────────────────────────────
function arePropsEqual(prev: ListingImageProps, next: ListingImageProps): boolean {
  // Compare imageUrls by content (join with '|') to avoid re‑render on new array references
  const prevUrls = prev.imageUrls?.join('|') ?? ''
  const nextUrls = next.imageUrls?.join('|') ?? ''
  if (prevUrls !== nextUrls) return false

  // Compare other props shallowly
  return (
    prev.fallbackUrl === next.fallbackUrl &&
    prev.imageType === next.imageType &&
    prev.alt === next.alt &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.objectFit === next.objectFit &&
    prev.placeholderIconSize === next.placeholderIconSize
  )
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
}: ListingImageProps) {
  const ui = useAppUi()

  // ─── Memoize URLs to avoid recomputation on every render ──────────────
  const urls = useMemo(() => getListingImageUrls(imageUrls, fallbackUrl), [imageUrls, fallbackUrl])
  const [activeIndex, setActiveIndex] = useState(0)
  const [failed, setFailed] = useState(false)

  // ─── Stable key for URL content ────────────────────────────────────────
  const urlsKey = useMemo(() => urls.join('|'), [urls])
  const prevUrlsKeyRef = useRef<string>(urlsKey)

  // ─── Memoize src and kind ──────────────────────────────────────────────
  const src = useMemo(() => urls[activeIndex] ?? null, [urls, activeIndex])
  const kind = useMemo(() => (src ? listingMediaKind(src, imageType) : 'image'), [src, imageType])

  // ─── Reset only when URL content actually changes ─────────────────────
  useEffect(() => {
    if (prevUrlsKeyRef.current !== urlsKey) {
      setActiveIndex(0)
      setFailed(false)
      prevUrlsKeyRef.current = urlsKey
    }
  }, [urlsKey])

  // ─── Placeholder ──────────────────────────────────────────────────────
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

  // ─── Render via ListingMediaPreview for all media types ──────────────
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
    />
  )
}, arePropsEqual)