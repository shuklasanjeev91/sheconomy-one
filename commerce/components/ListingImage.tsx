import { useEffect, useState } from 'react'

import { Icons, Image, YStack } from '~/components/ui'
import { getListingImageUrls } from '~/lib/listing-images'

type ListingImageProps = {
  imageUrls?: string[] | null
  fallbackUrl?: string | null
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
  alt,
  width = '100%',
  height = '100%',
  objectFit = 'cover',
  placeholderIconSize = 28,
}: ListingImageProps) {
  const urls = getListingImageUrls(imageUrls, fallbackUrl)
  const [activeIndex, setActiveIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const src = urls[activeIndex] ?? null

  useEffect(() => {
    setActiveIndex(0)
    setFailed(false)
  }, [urls.join('|')])

  if (!src || failed) {
    return (
      <YStack flex={1} width="100%" height="100%" alignItems="center" justifyContent="center">
        <Icons.Image size={placeholderIconSize} color="$color8" />
      </YStack>
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