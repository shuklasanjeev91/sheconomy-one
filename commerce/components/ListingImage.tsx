import { useEffect, useState } from 'react'

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

/** Listing photo with URL normalization and automatic fallback to the next image. */
export function ListingImage({
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
  const urls = getListingImageUrls(imageUrls, fallbackUrl)
  const [activeIndex, setActiveIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const src = urls[activeIndex] ?? null
  const kind = src ? listingMediaKind(src, imageType) : 'image'

  useEffect(() => {
    setActiveIndex(0)
    setFailed(false)
  }, [urls.join('|')])

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

  if (kind === 'video') {
    return (
      <ListingMediaPreview
        url={src}
        kind="video"
        alt={alt}
        width={width}
        height={height}
        objectFit={objectFit}
        placeholderIconSize={placeholderIconSize}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      objectFit={objectFit}
      onError={() => {
        if (activeIndex < urls.length - 1) {
          setActiveIndex((index) => index + 1)
          return
        }
        setFailed(true)
      }}
    />
  )
}