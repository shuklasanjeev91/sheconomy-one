import { useCallback, useEffect, useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { Platform } from 'react-native'

import { AUTH_BENEFIT_SLIDES } from '~/components/auth/auth-benefits'
import { useAuthLayout } from '~/components/auth/auth-layout'
import { ScrollView, Text, XStack, YStack } from '~/components/ui'

const AUTO_ADVANCE_MS = 5500

/** Desktop marketing panel carousel — glass benefit cards on brand gradient. */
export function AuthBenefitsCarousel() {
  const layout = useAuthLayout()
  const slides = AUTH_BENEFIT_SLIDES

  const [activeIndex, setActiveIndex] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [paused, setPaused] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const slideHeight = 148
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
    const timer = setInterval(() => goTo(activeIndex + 1), AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [activeIndex, goTo, paused, showNav, viewportWidth])

  const pause = useCallback(() => setPaused(true), [])
  const resume = useCallback(() => setPaused(false), [])

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!viewportWidth) return
    const index = Math.round(event.nativeEvent.contentOffset.x / viewportWidth)
    if (index !== activeIndex && index >= 0 && index < slides.length) {
      setActiveIndex(index)
    }
  }

  if (slides.length === 0) return null

  return (
    <YStack
      width="100%"
      gap="$3"
      onMouseEnter={Platform.OS === 'web' ? pause : undefined}
      onMouseLeave={Platform.OS === 'web' ? resume : undefined}
      {...(Platform.OS === 'web'
        ? {
            role: 'region',
            'aria-label': 'Platform benefits',
            'aria-roledescription': 'carousel',
          }
        : {})}
    >
      <YStack
        width="100%"
        overflow="hidden"
        borderRadius={16}
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
          {slides.map((slide) => {
            const Icon = slide.icon
            return (
              <XStack
                key={slide.title}
                width={viewportWidth || '100%'}
                height={slideHeight}
                paddingHorizontal="$4"
                paddingVertical="$3.5"
                gap="$3"
                alignItems="flex-start"
                backgroundColor={layout.glassBg}
                borderWidth={1}
                borderColor={layout.glassBorder}
                {...(Platform.OS === 'web'
                  ? { style: { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } }
                  : {})}
              >
                <YStack
                  width={44}
                  height={44}
                  borderRadius={12}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="rgba(255,255,255,0.14)"
                  borderWidth={1}
                  borderColor={layout.glassBorder}
                  flexShrink={0}
                >
                  <Icon size={20} color="white" />
                </YStack>
                <YStack flex={1} gap={5} minWidth={0} justifyContent="center">
                  <Text
                    fontSize={15}
                    fontWeight="700"
                    color="white"
                    letterSpacing={-0.15}
                    numberOfLines={2}
                  >
                    {slide.title}
                  </Text>
                  <Text
                    fontSize={13}
                    color={layout.trustText}
                    lineHeight={19}
                    numberOfLines={3}
                  >
                    {slide.body}
                  </Text>
                </YStack>
              </XStack>
            )
          })}
        </ScrollView>
      </YStack>

      {showNav ? (
        <XStack justifyContent="center" alignItems="center" gap={8}>
          {slides.map((slide, index) => {
            const active = index === activeIndex
            return (
              <YStack
                key={slide.title}
                width={active ? 18 : 7}
                height={7}
                borderRadius={999}
                backgroundColor={active ? 'white' : 'rgba(255,255,255,0.35)'}
                cursor="pointer"
                animation="quick"
                onPress={() => goTo(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            )
          })}
        </XStack>
      ) : null}
    </YStack>
  )
}
