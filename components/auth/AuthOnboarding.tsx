import { useCallback, useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { Platform } from 'react-native'

import { AUTH_ONBOARDING_SLIDES } from '~/components/auth/auth-benefits'
import { AUTH_LAYOUT, authPageStyle, authViewportStyle, useAuthLayout } from '~/components/auth/auth-layout'
import { AuthBackButton } from '~/components/auth/AuthBackButton'
import { AuthBrandLogo } from '~/components/auth/AuthBrandLogo'
import { BrandGradient, Button, Image, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { getSheconomyLogoUrl } from '~/lib/supabase/brand'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

type AuthOnboardingProps = {
  onFinish: () => void
}

/** Full-screen swipeable onboarding — mobile & tablet auth intro only. */
export function AuthOnboarding({ onFinish }: AuthOnboardingProps) {
  const ui = useAppUi()
  const layout = useAuthLayout()
  const { gutter, safeTop, safeBottom } = useAppLayout()
  const slides = AUTH_ONBOARDING_SLIDES
  const brandIconUrl = getSheconomyLogoUrl('icon')

  const [activeIndex, setActiveIndex] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  const isLast = activeIndex >= slides.length - 1

  const goTo = useCallback(
    (index: number) => {
      if (!viewportWidth || slides.length === 0) return
      const next = Math.max(0, Math.min(index, slides.length - 1))
      scrollRef.current?.scrollTo({ x: next * viewportWidth, animated: true })
      setActiveIndex(next)
    },
    [slides.length, viewportWidth],
  )

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!viewportWidth) return
    const index = Math.round(event.nativeEvent.contentOffset.x / viewportWidth)
    if (index !== activeIndex && index >= 0 && index < slides.length) {
      setActiveIndex(index)
    }
  }

  function handleNext() {
    if (isLast) {
      onFinish()
      return
    }
    goTo(activeIndex + 1)
  }

  return (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      minHeight={0}
      backgroundColor={ui.background}
      style={{ ...authViewportStyle(), ...authPageStyle(layout) }}
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal={gutter}
        paddingTop={Math.max(safeTop, 12)}
        paddingBottom="$3"
        zIndex={2}
        gap="$3"
      >
        <XStack flex={1} justifyContent="flex-start">
          <AuthBackButton showLabel={false} />
        </XStack>
        <XStack flex={1} justifyContent="center">
          <AuthBrandLogo compact />
        </XStack>
        <XStack flex={1} justifyContent="flex-end">
          <Button tone="ghost" size="$3" borderRadius={AUTH_LAYOUT.pillRadius} onPress={onFinish}>
            Skip
          </Button>
        </XStack>
      </XStack>

      <YStack
        flex={1}
        width="100%"
        minHeight={0}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          width="100%"
          height="100%"
        >
          {slides.map((slide) => {
            const Icon = slide.icon
            return (
              <YStack
                key={slide.title}
                width={viewportWidth || '100%'}
                flex={1}
                alignItems="center"
                justifyContent="center"
                paddingHorizontal={gutter}
                paddingVertical="$6"
                gap="$6"
              >
                <YStack
                  width={132}
                  height={132}
                  borderRadius={36}
                  alignItems="center"
                  justifyContent="center"
                  overflow="hidden"
                  position="relative"
                  style={
                    Platform.OS === 'web'
                      ? { boxShadow: '0 20px 48px rgba(208, 16, 96, 0.28)' }
                      : undefined
                  }
                >
                  <BrandGradient variant="brand" width="100%" height="100%" position="absolute" />
                  {slide.brandLogo ? (
                    <Image
                      src={brandIconUrl}
                      width={72}
                      height={72}
                      objectFit="contain"
                      alt={`${BRAND_NAME} icon`}
                    />
                  ) : (
                    <Icon size={52} color="white" strokeWidth={1.8} />
                  )}
                </YStack>

                <YStack gap="$3" alignItems="center" maxWidth={340}>
                  <Text
                    fontSize={28}
                    fontWeight="800"
                    color={ui.text}
                    letterSpacing={-0.6}
                    lineHeight={34}
                    textAlign="center"
                  >
                    {slide.title}
                  </Text>
                  <Text fontSize={16} color={ui.textSecondary} lineHeight={24} textAlign="center">
                    {slide.body}
                  </Text>
                </YStack>
              </YStack>
            )
          })}
        </ScrollView>
      </YStack>

      <YStack
        gap="$5"
        paddingHorizontal={gutter}
        paddingBottom={Math.max(safeBottom, 20) + 8}
        paddingTop="$2"
      >
        <XStack justifyContent="center" alignItems="center" gap={8}>
          {slides.map((slide, index) => {
            const active = index === activeIndex
            return (
              <YStack
                key={slide.title}
                width={active ? 22 : 8}
                height={8}
                borderRadius={999}
                backgroundColor={active ? ui.brand : ui.borderSubtle}
                animation="quick"
                onPress={() => goTo(index)}
                cursor="pointer"
                aria-label={`Go to slide ${index + 1}`}
              />
            )
          })}
        </XStack>

        <Button tone="primary" size="$4" width="100%" borderRadius={AUTH_LAYOUT.pillRadius} onPress={handleNext}>
          {isLast ? 'Get started' : 'Next'}
        </Button>
      </YStack>
    </YStack>
  )
}
