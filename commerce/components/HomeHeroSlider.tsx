import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { Link } from 'one'
import type { Href } from 'one'
import { Platform } from 'react-native'

import { BrandGradient, Button, Image, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import type { CommerceStats, HomeHeroImageSet } from '~/commerce/lib/commerce'
import { commerceRoutes, routes } from '~/lib/routes'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'
import type { gradients } from '~/config/tokens'

export type HomeHeroSlide = {
  id: keyof HomeHeroImageSet | 'sell'
  title: string
  subtitle: string
  cta: string
  href: Href
  gradient: keyof typeof gradients
  images: string[]
}

type HomeHeroSliderProps = {
  slides: HomeHeroSlide[]
}

const AUTO_ADVANCE_MS = 6000
const EMPTY_HERO_IMAGES: HomeHeroImageSet = {
  shops: [],
  physical: [],
  digital: [],
  trending: [],
  sell: [],
}

export function buildHomeHeroSlides(
  stats: CommerceStats,
  options?: { includeSellerSlide?: boolean; images?: HomeHeroImageSet },
): HomeHeroSlide[] {
  const images = options?.images ?? EMPTY_HERO_IMAGES

  const slides: HomeHeroSlide[] = [
    {
      id: 'shops',
      title: 'Discover women-led shops',
      subtitle: `${formatCount(stats.shops_with_listings)} unique storefronts on ${BRAND_NAME}`,
      cta: 'Shop now',
      href: commerceRoutes.shops,
      gradient: 'brand',
      images: images.shops,
    },
    {
      id: 'physical',
      title: 'Ships to you',
      subtitle: `${formatCount(stats.physical_listings)} listings ready to ship across India`,
      cta: 'Browse physical',
      href: commerceRoutes.browse('physical'),
      gradient: 'brandSubtle',
      images: images.physical,
    },
    {
      id: 'digital',
      title: 'Instant delivery',
      subtitle: `${formatCount(stats.digital_listings)} digital listings available now`,
      cta: 'Explore digital',
      href: commerceRoutes.browse('digital'),
      gradient: 'brand',
      images: images.digital,
    },
    {
      id: 'trending',
      title: 'Popular right now',
      subtitle: 'Trending picks from the community marketplace',
      cta: 'See trending',
      href: commerceRoutes.browse('trending'),
      gradient: 'brandSubtle',
      images: images.trending,
    },
  ]

  if (options?.includeSellerSlide) {
    slides.push({
      id: 'sell',
      title: 'Start selling today',
      subtitle: `Open your shop on ${BRAND_NAME} and reach shoppers nationwide`,
      cta: 'Open your shop',
      href: `${routes.myShops}?create=1` as Href,
      gradient: 'brand',
      images: images.sell.length ? images.sell : images.shops,
    })
  }

  return slides
}

export function HomeHeroSlider({ slides }: HomeHeroSliderProps) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const [activeIndex, setActiveIndex] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [paused, setPaused] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const slideHeight = isDesktop ? 380 : 300

  const goTo = useCallback(
    (index: number) => {
      if (!viewportWidth || slides.length === 0) return
      const next = ((index % slides.length) + slides.length) % slides.length
      scrollRef.current?.scrollTo({ x: next * viewportWidth, animated: true })
      setActiveIndex(next)
    },
    [slides.length, viewportWidth],
  )

  useEffect(() => {
    if (slides.length <= 1 || paused || !viewportWidth) return
    const timer = setInterval(() => {
      goTo(activeIndex + 1)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [activeIndex, goTo, paused, slides.length, viewportWidth])

  const dots = useMemo(
    () =>
      slides.map((slide, index) => (
        <YStack
          key={slide.id}
          width={index === activeIndex ? 22 : 8}
          height={8}
          borderRadius={999}
          backgroundColor={index === activeIndex ? 'white' : 'rgba(255,255,255,0.45)'}
          onPress={() => goTo(index)}
          cursor="pointer"
          animation="quick"
        />
      )),
    [activeIndex, goTo, slides],
  )

  if (slides.length === 0) return null

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!viewportWidth) return
    const index = Math.round(event.nativeEvent.contentOffset.x / viewportWidth)
    if (index !== activeIndex && index >= 0 && index < slides.length) {
      setActiveIndex(index)
    }
  }

  return (
    <YStack
      width="100%"
      position="relative"
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      onMouseEnter={Platform.OS === 'web' ? () => setPaused(true) : undefined}
      onMouseLeave={Platform.OS === 'web' ? () => setPaused(false) : undefined}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        width="100%"
        height={slideHeight}
      >
        {slides.map((slide) => (
          <YStack key={slide.id} width={viewportWidth || '100%'} height={slideHeight} position="relative" overflow="hidden">
            <BrandGradient variant={slide.gradient} width="100%" height="100%" position="absolute" />
            <HeroRelatedImages images={slide.images} isDesktop={isDesktop} />
            <YStack
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              style={{
                background:
                  'linear-gradient(105deg, rgba(18, 8, 13, 0.78) 0%, rgba(18, 8, 13, 0.42) 46%, rgba(208, 16, 96, 0.28) 100%)',
              }}
            />
            <YStack
              flex={1}
              justifyContent="center"
              paddingHorizontal={isDesktop ? 56 : 24}
              paddingVertical="$5"
              gap="$4"
              maxWidth={isDesktop ? 560 : 720}
              zIndex={2}
            >
              <YStack gap="$2">
                <Text
                  fontSize={isDesktop ? 40 : 28}
                  fontWeight="800"
                  color="white"
                  letterSpacing={-1}
                  lineHeight={isDesktop ? 44 : 32}
                >
                  {slide.title}
                </Text>
                <Text fontSize={isDesktop ? 17 : 15} color="rgba(255,255,255,0.9)" lineHeight={24} maxWidth={520}>
                  {slide.subtitle}
                </Text>
              </YStack>
              <Link href={slide.href} asChild>
                <Button
                  tone="primary"
                  size={isDesktop ? '$4' : '$3'}
                  borderRadius={999}
                  alignSelf="flex-start"
                  backgroundColor="white"
                  color={ui.brand}
                  hoverStyle={{ opacity: 0.92 }}
                >
                  {slide.cta}
                </Button>
              </Link>
            </YStack>
          </YStack>
        ))}
      </ScrollView>

      {slides.length > 1 ? (
        <XStack
          position="absolute"
          bottom={16}
          left={0}
          right={0}
          justifyContent="center"
          gap={6}
          pointerEvents="box-none"
          zIndex={3}
        >
          {dots}
        </XStack>
      ) : null}
    </YStack>
  )
}

function HeroRelatedImages({ images, isDesktop }: { images: string[]; isDesktop: boolean }) {
  if (!images.length) return null

  const primary = images[0]
  const mosaic = images.slice(1, isDesktop ? 5 : 4)

  return (
    <YStack position="absolute" top={0} left={0} right={0} bottom={0} overflow="hidden" pointerEvents="none">
      <Image
        src={primary}
        alt=""
        width="100%"
        height="100%"
        objectFit="cover"
        opacity={0.55}
        position="absolute"
      />

      {mosaic.length > 0 ? (
        <XStack
          position="absolute"
          right={isDesktop ? 40 : 16}
          bottom={isDesktop ? 44 : 36}
          gap={isDesktop ? 10 : 8}
          alignItems="flex-end"
        >
          {mosaic.map((url, index) => {
            const size = isDesktop ? (index === 0 ? 118 : 92) : index === 0 ? 78 : 64
            return (
              <YStack
                key={`${url}-${index}`}
                width={size}
                height={size}
                borderRadius={18}
                overflow="hidden"
                borderWidth={2}
                borderColor="rgba(255,255,255,0.55)"
                style={{
                  transform: [{ rotate: index % 2 === 0 ? '-4deg' : '5deg' }],
                  boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
                }}
              >
                <Image src={url} alt="" width="100%" height="100%" objectFit="cover" />
              </YStack>
            )
          })}
        </XStack>
      ) : null}
    </YStack>
  )
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}
