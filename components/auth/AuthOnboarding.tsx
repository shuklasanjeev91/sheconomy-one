import { useCallback, useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { Platform, StatusBar } from 'react-native'
import * as Haptics from 'expo-haptics'

import { AUTH_ONBOARDING_SLIDES } from '~/components/auth/auth-benefits'
import { AUTH_LAYOUT, authViewportStyle } from '~/components/auth/auth-layout'
import { AuthBackButton } from '~/components/auth/AuthBackButton'
import { BrandGradient, Button, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { BrandLogo } from '~/components/brand/BrandLogo'
import { useAppLayout } from '~/hooks/useAppLayout'
import { BRAND_NAME } from '~/config/brand'

type AuthOnboardingProps = {
  onFinish: () => void
  /**
   * `app` — first cold launch (native). No back chevron; “Get started” enters the app.
   * `auth` — shown before sign-in on compact layouts; optional back to leave auth.
   */
  variant?: 'app' | 'auth'
}

async function hapticLight() {
  if (Platform.OS === 'web') return
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  } catch {
    // ignore missing haptics hardware
  }
}

async function hapticSuccess() {
  if (Platform.OS === 'web') return
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  } catch {
    // ignore
  }
}

/**
 * Full-screen swipeable onboarding — professional native intro for iOS & Android
 * (also used on compact web auth). Brand gradient canvas, large icon, clear CTAs.
 */
export function AuthOnboarding({ onFinish, variant = 'auth' }: AuthOnboardingProps) {
  const layout = useAppLayout()
  const { gutter, safeTop, safeBottom } = layout
  const slides = AUTH_ONBOARDING_SLIDES
  const isAppLaunch = variant === 'app'

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

  async function handleNext() {
    if (isLast) {
      await hapticSuccess()
      onFinish()
      return
    }
    await hapticLight()
    goTo(activeIndex + 1)
  }

  async function handleSkip() {
    await hapticLight()
    onFinish()
  }

  return (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      minHeight={0}
      backgroundColor="#9d0844"
      overflow="hidden"
      style={authViewportStyle()}
    >
      {Platform.OS !== 'web' ? <StatusBar barStyle="light-content" /> : null}

      <BrandGradient variant="brand" />

      {/* Soft vignette for readable type on gradient */}
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        backgroundColor="rgba(26, 10, 18, 0.18)"
        pointerEvents="none"
      />

      <XStack
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal={gutter}
        paddingTop={Math.max(safeTop, Platform.OS === 'android' ? 16 : 12)}
        paddingBottom="$3"
        zIndex={2}
        gap="$3"
      >
        <XStack flex={1} justifyContent="flex-start" minHeight={40}>
          {!isAppLaunch ? <AuthBackButton showLabel={false} variant="light" /> : null}
        </XStack>
        <XStack flex={1} justifyContent="center" alignItems="center">
          <Text
            fontSize={15}
            fontWeight="800"
            color="rgba(255,255,255,0.95)"
            letterSpacing={0.4}
            textTransform="uppercase"
          >
            {BRAND_NAME}
          </Text>
        </XStack>
        <XStack flex={1} justifyContent="flex-end">
          <Button
            tone="ghost"
            size="$3"
            borderRadius={AUTH_LAYOUT.pillRadius}
            onPress={() => void handleSkip()}
            color="white"
            hoverStyle={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
            pressStyle={{ opacity: 0.85 }}
          >
            Skip
          </Button>
        </XStack>
      </XStack>

      <YStack
        flex={1}
        width="100%"
        minHeight={0}
        zIndex={1}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
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
                paddingHorizontal={Math.max(gutter, 28)}
                paddingVertical="$6"
                gap="$7"
              >
                <YStack
                  width={148}
                  height={148}
                  borderRadius={40}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="rgba(255,255,255,0.16)"
                  borderWidth={1}
                  borderColor="rgba(255,255,255,0.28)"
                  {...(Platform.OS === 'web'
                    ? { style: { boxShadow: '0 24px 56px rgba(0,0,0,0.28)' } }
                    : {
                        shadowColor: '#000',
                        shadowOpacity: 0.28,
                        shadowRadius: 24,
                        shadowOffset: { width: 0, height: 16 },
                        elevation: 12,
                      })}
                >
                  {slide.brandLogo ? (
                    <BrandLogo variant="icon" width={78} height={78} />
                  ) : (
                    <Icon size={56} color="white" strokeWidth={1.7} />
                  )}
                </YStack>

                <YStack gap="$3" alignItems="center" maxWidth={360}>
                  <Text
                    fontSize={Platform.OS === 'web' ? 30 : 32}
                    fontWeight="800"
                    color="white"
                    letterSpacing={-0.7}
                    lineHeight={38}
                    textAlign="center"
                  >
                    {slide.title}
                  </Text>
                  <Text
                    fontSize={16}
                    color="rgba(255,255,255,0.88)"
                    lineHeight={24}
                    textAlign="center"
                    fontWeight="500"
                  >
                    {slide.body}
                  </Text>
                </YStack>
              </YStack>
            )
          })}
        </ScrollView>
      </YStack>

      <YStack
        zIndex={2}
        gap="$4"
        paddingHorizontal={gutter}
        paddingBottom={Math.max(safeBottom, 20) + 10}
        paddingTop="$2"
      >
        <XStack justifyContent="center" alignItems="center" gap={8}>
          {slides.map((slide, index) => {
            const active = index === activeIndex
            return (
              <YStack
                key={slide.title}
                width={active ? 24 : 8}
                height={8}
                borderRadius={999}
                backgroundColor={active ? 'white' : 'rgba(255,255,255,0.35)'}
                animation="quick"
                onPress={() => {
                  void hapticLight()
                  goTo(index)
                }}
                cursor="pointer"
                accessibilityLabel={`Go to slide ${index + 1}`}
                accessibilityRole="button"
              />
            )
          })}
        </XStack>

        <Button
          tone="primary"
          size="$5"
          width="100%"
          borderRadius={AUTH_LAYOUT.pillRadius}
          backgroundColor="white"
          color="#9d0844"
          fontWeight="800"
          pressStyle={{ opacity: 0.92, scale: 0.985 }}
          onPress={() => void handleNext()}
        >
          {isLast ? (isAppLaunch ? 'Get started' : 'Continue to sign in') : 'Next'}
        </Button>

        {isLast && isAppLaunch ? (
          <Text fontSize={13} color="rgba(255,255,255,0.72)" textAlign="center" fontWeight="500">
            Browse freely — sign in when you’re ready for Community, Chat, and more.
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )
}
