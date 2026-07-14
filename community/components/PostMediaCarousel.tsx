import { useRef, useState } from 'react'
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { Platform } from 'react-native'

import { isGifUrl } from '~/community/lib/giphy'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Icons, Image, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'

type PostMediaCarouselProps = {
  urls: string[]
  /** Fixed slide height. */
  height?: number
  /** contain = show whole image (LinkedIn carousel); cover = fill/crop. */
  fit?: 'cover' | 'contain'
  /** Tapping a slide (fires with the tapped index). */
  onPressImage?: (index: number) => void
  rounded?: boolean
}

/** LinkedIn-style swipeable image carousel: paging, arrows, dots and a counter. */
export function PostMediaCarousel({
  urls,
  height = 380,
  fit = 'contain',
  onPressImage,
  rounded = true,
}: PostMediaCarouselProps) {
  const communityUi = useCommunityUi()
  const scrollRef = useRef<ScrollView>(null)
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)
  const isWeb = Platform.OS === 'web'

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width)
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return
    const next = Math.round(event.nativeEvent.contentOffset.x / width)
    if (next !== index) setIndex(Math.max(0, Math.min(next, urls.length - 1)))
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(next, urls.length - 1))
    setIndex(clamped)
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true })
  }

  return (
    <YStack
      width="100%"
      height={height}
      borderRadius={rounded ? radius.card : 0}
      overflow="hidden"
      backgroundColor="#000"
      position="relative"
      onLayout={onLayout}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
      >
        {urls.map((url, i) => (
          <YStack
            key={`${url}-${i}`}
            width={width || undefined}
            height={height}
            alignItems="center"
            justifyContent="center"
            cursor={onPressImage ? 'pointer' : 'default'}
            {...(onPressImage ? { onPress: () => onPressImage(i) } : {})}
          >
            {width ? (
              isGifUrl(url) ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <img
                  src={url}
                  style={{ width: '100%', height: '100%', objectFit: fit }}
                />
              ) : (
                <Image src={url} width={width} height={height} objectFit={fit} alt="" />
              )
            ) : null}
          </YStack>
        ))}
      </ScrollView>

      {/* Counter */}
      <XStack
        position="absolute"
        top={10}
        right={10}
        paddingHorizontal={8}
        paddingVertical={3}
        borderRadius={999}
        backgroundColor="rgba(0,0,0,0.6)"
        pointerEvents="none"
      >
        <Text fontSize={12} fontWeight="700" color="white">
          {index + 1}/{urls.length}
        </Text>
      </XStack>

      {/* Desktop arrows */}
      {isWeb ? (
        <>
          {index > 0 ? (
            <CarouselArrow side="left" onPress={() => goTo(index - 1)} />
          ) : null}
          {index < urls.length - 1 ? (
            <CarouselArrow side="right" onPress={() => goTo(index + 1)} />
          ) : null}
        </>
      ) : null}

      {/* Dots */}
      <XStack
        position="absolute"
        bottom={10}
        left={0}
        right={0}
        justifyContent="center"
        gap={6}
        pointerEvents="none"
      >
        {urls.map((url, i) => (
          <YStack
            key={`dot-${url}-${i}`}
            width={i === index ? 18 : 6}
            height={6}
            borderRadius={999}
            backgroundColor={i === index ? communityUi.brand : 'rgba(255,255,255,0.6)'}
          />
        ))}
      </XStack>
    </YStack>
  )
}

function CarouselArrow({ side, onPress }: { side: 'left' | 'right'; onPress: () => void }) {
  const Icon = side === 'left' ? Icons.ChevronLeft : Icons.ChevronRight
  return (
    <XStack
      position="absolute"
      top="50%"
      y={-18}
      {...(side === 'left' ? { left: 10 } : { right: 10 })}
      width={36}
      height={36}
      borderRadius={999}
      alignItems="center"
      justifyContent="center"
      backgroundColor="rgba(255,255,255,0.92)"
      cursor="pointer"
      hoverStyle={{ backgroundColor: 'white', scale: 1.05 }}
      pressStyle={{ scale: 0.94 }}
      animation="quick"
      onPress={onPress}
    >
      <Icon size={22} color="#1a1a1a" />
    </XStack>
  )
}
