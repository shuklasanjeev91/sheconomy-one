import { useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import { Icons, ScrollView, XStack, YStack } from '~/components/ui'
import { useMobileBackNavigation } from '~/hooks/useMobileBackNavigation'
import { useAppUi } from '~/lib/theme/useAppUi'

import { FavoriteButton } from './FavoriteButton'
import { ListingImage } from './ListingImage'

type GalleryImage = {
  id: string
  image_url: string
  alt_text?: string | null
}

type ListingMobileGalleryProps = {
  images: GalleryImage[]
  title: string
  listingId: string
  activeIndex: number
  onIndexChange: (index: number) => void
}

/** Etsy mobile — full-bleed swipeable gallery with dots, back + favorite overlays. */
export function ListingMobileGallery({
  images,
  title,
  listingId,
  activeIndex,
  onIndexChange,
}: ListingMobileGalleryProps) {
  const ui = useAppUi()
  const { goBack } = useMobileBackNavigation()
  const [viewportWidth, setViewportWidth] = useState(0)

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!viewportWidth) return
    const index = Math.round(event.nativeEvent.contentOffset.x / viewportWidth)
    if (index !== activeIndex) onIndexChange(index)
  }

  return (
    <YStack
      width="100%"
      backgroundColor={ui.imagePlaceholder}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
    >
      <YStack width="100%" aspectRatio={1} position="relative">
        {images.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            width="100%"
            height="100%"
          >
            {images.map((image) => (
              <YStack key={image.id} width={viewportWidth || '100%'} height="100%">
                <ListingImage
                  imageUrls={[image.image_url]}
                  alt={image.alt_text ?? title}
                  width="100%"
                  height="100%"
                  objectFit="cover"
                  placeholderIconSize={48}
                />
              </YStack>
            ))}
          </ScrollView>
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Icons.Image size={48} color={ui.textMuted} />
          </YStack>
        )}

        <XStack
          position="absolute"
          top={12}
          left={12}
          zIndex={3}
          width={40}
          height={40}
          borderRadius={999}
          backgroundColor={ui.deliveryBg}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          onPress={goBack}
          aria-label="Go back"
        >
          <Icons.ArrowLeft size={20} color={ui.text} />
        </XStack>

        <FavoriteButton listingId={listingId} size={18} />
      </YStack>

      {images.length > 1 ? (
        <XStack justifyContent="center" gap={6} paddingVertical="$2.5">
          {images.map((image, index) => (
            <YStack
              key={image.id}
              width={index === activeIndex ? 8 : 6}
              height={index === activeIndex ? 8 : 6}
              borderRadius={999}
              backgroundColor={index === activeIndex ? ui.overlayDotActive : ui.borderSubtle}
            />
          ))}
        </XStack>
      ) : null}
    </YStack>
  )
}