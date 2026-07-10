import { useState } from 'react'
import { Platform } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import { Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
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

const glassButtonStyle = (ui: ReturnType<typeof useAppUi>) =>
  Platform.select({
    web: {
      backgroundColor: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(12px) saturate(160%)',
      WebkitBackdropFilter: 'blur(12px) saturate(160%)',
      boxShadow: '0 4px 16px rgba(16, 12, 14, 0.12)',
    },
    default: {
      backgroundColor: ui.deliveryBg,
    },
  })

/** Full-bleed swipeable gallery with glass controls, counter pill, and progress dots. */
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
          width={44}
          height={44}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          onPress={goBack}
          aria-label="Go back"
          pressStyle={{ scale: 0.94, opacity: 0.9 }}
          animation="quick"
          style={glassButtonStyle(ui)}
        >
          <Icons.ArrowLeft size={20} color={ui.text} />
        </XStack>

        {images.length > 1 ? (
          <XStack
            position="absolute"
            top={16}
            right={16}
            zIndex={3}
            paddingHorizontal={12}
            paddingVertical={6}
            borderRadius={999}
            style={glassButtonStyle(ui)}
          >
            <Text fontSize={12} fontWeight="700" color={ui.text} letterSpacing={0.2}>
              {activeIndex + 1} / {images.length}
            </Text>
          </XStack>
        ) : null}

        <FavoriteButton listingId={listingId} size={18} />
      </YStack>

      {images.length > 1 ? (
        <XStack justifyContent="center" gap={6} paddingVertical="$3">
          {images.map((image, index) => (
            <YStack
              key={image.id}
              width={index === activeIndex ? 20 : 6}
              height={6}
              borderRadius={999}
              backgroundColor={index === activeIndex ? ui.brand : ui.borderSubtle}
              animation="quick"
              cursor="pointer"
              onPress={() => onIndexChange(index)}
            />
          ))}
        </XStack>
      ) : null}
    </YStack>
  )
}
