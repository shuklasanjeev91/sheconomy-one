import { useCallback, useEffect, useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import type { Href } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { Platform } from 'react-native'

import { BrandGradient, Button, Icons, Image, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import type { CommerceStats, HomeHeroImageSet } from '~/commerce/lib/commerce'
import { commerceRoutes, routes } from '~/lib/routes'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'
import { motion } from '~/lib/theme/motion'
import { useThemedShadowStyle } from '~/lib/theme/useThemedShadowStyle'
import { radius } from '~/config/tokens'
import type { gradients } from '~/config/tokens'

export type HomeHeroSlide = {
  id: keyof HomeHeroImageSet | 'sell'
  eyebrow: string
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

const AUTO_ADVANCE_MS = 7000
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
      eyebrow: 'Curated marketplace',
      title: 'Discover women-led shops',
      subtitle: `${formatCount(stats.shops_with_listings)} unique storefronts on ${BRAND_NAME}`,
      cta: 'Shop now',
      href: commerceRoutes.shops,
      gradient: 'brand',
      images: images.shops,
    },
    {
      id: 'physical',
      eyebrow: 'Ships nationwide',
      title: 'Physical products, delivered',
      subtitle: `${formatCount(stats.physical_listings)} listings ready to ship across India`,
      cta: 'Browse physical',
      href: commerceRoutes.browse('physical'),
      gradient: 'brandSubtle',
      images: images.physical,
    },
    {
      id: 'digital',
      eyebrow: 'Instant access',
      title: 'Digital goods in seconds',
      subtitle: `${formatCount(stats.digital_listings)} digital listings available now`,
      cta: 'Explore digital',
      href: commerceRoutes.browse('digital'),
      gradient: 'brand',
      images: images.digital,
    },
    {
      id: 'trending',
      eyebrow: 'Community picks',
      title: 'Popular right now',
      subtitle: 'Trending finds from makers and sellers you will love',
      cta: 'See trending',
      href: commerceRoutes.browse('trending'),
      gradient: 'brandSubtle',
      images: images.trending,
    },
  ]

  if (options?.includeSellerSlide) {
    slides.push({
      id: 'sell',
      eyebrow: 'Start selling',
      title: 'Open your shop today',
      subtitle: `Reach shoppers nationwide on ${BRAND_NAME} in minutes`,
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
  const { isDesktop, gutter } = useAppLayout()
  const heroShadow = useThemedShadowStyle('lg')
  const [activeIndex, setActiveIndex] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [paused, setPaused] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const slideHeight = isDesktop ? 428 : 356
  const showNav = slides.length > 1

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
    if (!showNav || paused || !viewportWidth) return
    const timer = setInterval(() => {
      goTo(activeIndex + 1)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [activeIndex, goTo, paused, showNav, viewportWidth])

  const pause = useCallback(() => setPaused(true), [])
  const resume = useCallback(() => setPaused(false), [])

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
      paddingHorizontal={isDesktop ? gutter : 0}
      onMouseEnter={Platform.OS === 'web' ? pause : undefined}
      onMouseLeave={Platform.OS === 'web' ? resume : undefined}
      {...(Platform.OS === 'web'
        ? {
            onKeyDown: (event: { key: string }) => {
              if (event.key === 'ArrowLeft') goTo(activeIndex - 1)
              if (event.key === 'ArrowRight') goTo(activeIndex + 1)
            },
            tabIndex: 0,
            role: 'region',
            'aria-label': 'Featured highlights',
            'aria-roledescription': 'carousel',
          }
        : {})}
    >
      <YStack
        width="100%"
        position="relative"
        borderRadius={isDesktop ? radius.surface : 0}
        overflow="hidden"
        borderWidth={isDesktop ? 1 : 0}
        borderColor={ui.borderSubtle}
        style={isDesktop ? heroShadow : undefined}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        onTouchStart={pause}
        onTouchEnd={resume}
        onTouchCancel={resume}
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
          {slides.map((slide, index) => (
            <HeroSlidePanel
              key={slide.id}
              slide={slide}
              width={viewportWidth || '100%'}
              height={slideHeight}
              isDesktop={isDesktop}
              isActive={index === activeIndex}
              ui={ui}
            />
          ))}
        </ScrollView>

        {showNav ? (
          <>
            {isDesktop ? (
              <>
                <HeroNavButton direction="prev" onPress={() => goTo(activeIndex - 1)} left={16} />
                <HeroNavButton direction="next" onPress={() => goTo(activeIndex + 1)} right={16} />
              </>
            ) : null}

            <HeroPagination
              slides={slides}
              activeIndex={activeIndex}
              onSelect={goTo}
              paused={paused}
              autoAdvanceMs={AUTO_ADVANCE_MS}
            />
          </>
        ) : null}
      </YStack>
    </YStack>
  )
}

type HeroSlidePanelProps = {
  slide: HomeHeroSlide
  width: number | string
  height: number
  isDesktop: boolean
  isActive: boolean
  ui: ReturnType<typeof useAppUi>
}

function HeroSlidePanel({ slide, width, height, isDesktop, isActive, ui }: HeroSlidePanelProps) {
  return (
    <YStack width={width} height={height} position="relative" overflow="hidden">
      <HeroBackdrop slide={slide} isDesktop={isDesktop} />

      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        zIndex={1}
        pointerEvents="none"
        {...(Platform.OS === 'web'
          ? {
              style: {
                background: isDesktop
                  ? 'linear-gradient(100deg, rgba(12, 6, 10, 0.88) 0%, rgba(12, 6, 10, 0.52) 42%, rgba(208, 16, 96, 0.22) 100%)'
                  : 'linear-gradient(180deg, rgba(12, 6, 10, 0.55) 0%, rgba(12, 6, 10, 0.82) 55%, rgba(12, 6, 10, 0.92) 100%)',
              },
            }
          : { backgroundColor: 'rgba(12, 6, 10, 0.72)' })}
      />

      <XStack
        flex={1}
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal={isDesktop ? 48 : 22}
        paddingVertical={isDesktop ? 40 : 28}
        paddingBottom={isDesktop ? 52 : 44}
        gap={isDesktop ? 32 : 0}
        zIndex={2}
      >
        <YStack
          flex={1}
          gap={isDesktop ? '$4' : '$3'}
          maxWidth={isDesktop ? 520 : 720}
          justifyContent="center"
          {...motion.fadeUp}
          opacity={isActive ? 1 : 0.92}
        >
          <XStack
            alignSelf="flex-start"
            paddingHorizontal={12}
            paddingVertical={6}
            borderRadius={radius.pill}
            backgroundColor="rgba(255,255,255,0.14)"
            borderWidth={1}
            borderColor="rgba(255,255,255,0.22)"
            {...(Platform.OS === 'web'
              ? { style: { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } }
              : {})}
          >
            <Text fontSize={11} fontWeight="700" color="rgba(255,255,255,0.95)" letterSpacing={1.2} textTransform="uppercase">
              {slide.eyebrow}
            </Text>
          </XStack>

          <YStack gap="$2">
            <Text
              fontSize={isDesktop ? 42 : 30}
              fontWeight="800"
              color="white"
              letterSpacing={isDesktop ? -1.2 : -0.8}
              lineHeight={isDesktop ? 46 : 34}
            >
              {slide.title}
            </Text>
            <Text
              fontSize={isDesktop ? 17 : 15}
              color="rgba(255,255,255,0.88)"
              lineHeight={isDesktop ? 26 : 22}
              maxWidth={480}
            >
              {slide.subtitle}
            </Text>
          </YStack>

          <AppLink href={slide.href} asChild>
            <Button
              tone="primary"
              size={isDesktop ? '$4' : '$3'}
              borderRadius={radius.pill}
              alignSelf="flex-start"
              backgroundColor="white"
              color={ui.brand}
              paddingHorizontal={isDesktop ? 24 : 20}
              hoverStyle={{ opacity: 0.94, scale: 1.02 }}
              pressStyle={{ opacity: 0.88, scale: 0.98 }}
              iconAfter={<Icons.ArrowRight size={18} color={ui.brand} strokeWidth={2.4} />}
            >
              {slide.cta}
            </Button>
          </AppLink>
        </YStack>

        {isDesktop ? <HeroThumbStrip images={slide.images} /> : null}
      </XStack>
    </YStack>
  )
}

function HeroBackdrop({ slide, isDesktop }: { slide: HomeHeroSlide; isDesktop: boolean }) {
  const primary = slide.images[0]

  if (!primary) {
    return <BrandGradient variant={slide.gradient} width="100%" height="100%" position="absolute" />
  }

  return (
    <YStack position="absolute" top={0} left={0} right={0} bottom={0} overflow="hidden">
      <Image
        src={primary}
        alt=""
        width="100%"
        height="100%"
        objectFit="cover"
        position="absolute"
        opacity={isDesktop ? 0.72 : 0.58}
        {...(Platform.OS === 'web'
          ? {
              style: {
                transform: 'scale(1.04)',
                transformOrigin: 'center center',
              },
            }
          : {})}
      />
      <BrandGradient
        variant={slide.gradient}
        width="100%"
        height="100%"
        position="absolute"
        opacity={0.35}
      />
    </YStack>
  )
}

function HeroThumbStrip({ images }: { images: string[] }) {
  const thumbs = images.slice(1, 4)
  if (thumbs.length === 0) return null

  return (
    <YStack
      width={148}
      gap={10}
      padding={10}
      borderRadius={radius.card}
      backgroundColor="rgba(255,255,255,0.1)"
      borderWidth={1}
      borderColor="rgba(255,255,255,0.18)"
      flexShrink={0}
      {...(Platform.OS === 'web'
        ? { style: { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } }
        : {})}
    >
      {thumbs.map((url, index) => (
        <YStack
          key={`${url}-${index}`}
          width="100%"
          height={index === 0 ? 88 : 72}
          borderRadius={14}
          overflow="hidden"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.28)"
        >
          <Image src={url} alt="" width="100%" height="100%" objectFit="cover" />
        </YStack>
      ))}
    </YStack>
  )
}

function HeroNavButton({
  direction,
  onPress,
  left,
  right,
}: {
  direction: 'prev' | 'next'
  onPress: () => void
  left?: number
  right?: number
}) {
  const Icon = direction === 'prev' ? Icons.ChevronLeft : Icons.ChevronRight

  return (
    <XStack
      position="absolute"
      top="50%"
      left={left}
      right={right}
      y={-22}
      width={44}
      height={44}
      borderRadius={radius.pill}
      alignItems="center"
      justifyContent="center"
      backgroundColor="rgba(255,255,255,0.16)"
      borderWidth={1}
      borderColor="rgba(255,255,255,0.28)"
      cursor="pointer"
      zIndex={4}
      hoverStyle={{ backgroundColor: 'rgba(255,255,255,0.26)', scale: 1.04 }}
      pressStyle={{ opacity: 0.85, scale: 0.96 }}
      animation="quick"
      onPress={onPress}
      aria-label={direction === 'prev' ? 'Previous slide' : 'Next slide'}
      {...(Platform.OS === 'web'
        ? { style: { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } }
        : {})}
    >
      <Icon size={22} color="white" strokeWidth={2.2} />
    </XStack>
  )
}

function HeroPagination({
  slides,
  activeIndex,
  onSelect,
  paused,
  autoAdvanceMs,
}: {
  slides: HomeHeroSlide[]
  activeIndex: number
  onSelect: (index: number) => void
  paused: boolean
  autoAdvanceMs: number
}) {
  return (
    <XStack
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      paddingHorizontal={20}
      paddingBottom={16}
      paddingTop={28}
      alignItems="center"
      justifyContent="space-between"
      gap={12}
      pointerEvents="box-none"
      zIndex={3}
      {...(Platform.OS === 'web'
        ? {
            style: {
              background: 'linear-gradient(180deg, transparent 0%, rgba(12, 6, 10, 0.55) 100%)',
            },
          }
        : { backgroundColor: 'rgba(12, 6, 10, 0.35)' })}
    >
      <XStack gap={8} alignItems="center" pointerEvents="auto">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex
          return (
            <YStack
              key={slide.id}
              height={6}
              width={isActive ? 28 : 8}
              borderRadius={999}
              backgroundColor={isActive ? 'white' : 'rgba(255,255,255,0.38)'}
              cursor="pointer"
              animation="quick"
              onPress={() => onSelect(index)}
              overflow="hidden"
              aria-label={`Go to slide ${index + 1}`}
            >
              {isActive ? (
                <YStack
                  height="100%"
                  width="100%"
                  backgroundColor="white"
                  {...(Platform.OS === 'web' && !paused
                    ? {
                        animation: 'none',
                        style: {
                          animation: `heroProgress ${autoAdvanceMs}ms linear forwards`,
                          transformOrigin: 'left center',
                        },
                      }
                    : {})}
                />
              ) : null}
            </YStack>
          )
        })}
      </XStack>

      <Text fontSize={12} fontWeight="600" color="rgba(255,255,255,0.82)" letterSpacing={0.4}>
        {activeIndex + 1} / {slides.length}
      </Text>
    </XStack>
  )
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}
