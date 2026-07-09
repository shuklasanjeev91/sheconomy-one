import { useEffect, useState } from 'react'

import { AUTH_BENEFIT_SLIDES } from '~/components/auth/auth-benefits'
import { useAuthUi } from '~/components/auth/auth-theme'
import { Icons, Text, XStack, YStack } from '~/components/ui'

const AUTO_ADVANCE_MS = 5500

export function AuthBenefitsCarousel() {
  const authUi = useAuthUi()
  const [index, setIndex] = useState(0)
  const slide = AUTH_BENEFIT_SLIDES[index]
  const SlideIcon = slide.icon
  const total = AUTH_BENEFIT_SLIDES.length

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % total)
    }, AUTO_ADVANCE_MS)

    return () => clearInterval(timer)
  }, [total])

  function goTo(nextIndex: number) {
    setIndex((nextIndex + total) % total)
  }

  return (
    <YStack gap="$4" width="100%">
      <YStack
        minHeight={176}
        justifyContent="space-between"
        gap="$4"
        padding="$5"
        borderRadius={20}
        backgroundColor={authUi.glassBg}
        borderWidth={1}
        borderColor={authUi.glassBorder}
        style={{ backdropFilter: 'blur(12px)' }}
      >
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
          <YStack
            width={48}
            height={48}
            borderRadius={14}
            backgroundColor={authUi.glassHighlight}
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <SlideIcon size={24} color="white" />
          </YStack>
          <Text color={authUi.trustMuted} fontSize={12} fontWeight="700" letterSpacing={0.6}>
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </Text>
        </XStack>

        <YStack gap="$2">
          <Text color="white" fontSize={20} fontWeight="800" lineHeight={26} letterSpacing={-0.3}>
            {slide.title}
          </Text>
          <Text color={authUi.trustText} fontSize={14} lineHeight={22}>
            {slide.body}
          </Text>
        </YStack>
      </YStack>

      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <XStack gap="$2" alignItems="center" flex={1}>
          {AUTH_BENEFIT_SLIDES.map((item, dotIndex) => (
            <YStack
              key={item.title}
              flex={dotIndex === index ? 1 : undefined}
              width={dotIndex === index ? undefined : 8}
              maxWidth={dotIndex === index ? 32 : 8}
              height={8}
              borderRadius={999}
              backgroundColor={dotIndex === index ? 'white' : 'rgba(255,255,255,0.28)'}
              cursor="pointer"
              onPress={() => goTo(dotIndex)}
              aria-label={`Show benefit ${dotIndex + 1}`}
            />
          ))}
        </XStack>

        <XStack gap="$2" alignItems="center">
          <CarouselControl direction="prev" onPress={() => goTo(index - 1)} />
          <CarouselControl direction="next" onPress={() => goTo(index + 1)} />
        </XStack>
      </XStack>
    </YStack>
  )
}

function CarouselControl({
  direction,
  onPress,
}: {
  direction: 'prev' | 'next'
  onPress: () => void
}) {
  const authUi = useAuthUi()
  const Icon = direction === 'prev' ? Icons.ChevronLeft : Icons.ChevronRight

  return (
    <XStack
      width={34}
      height={34}
      borderRadius={999}
      backgroundColor={authUi.glassBg}
      borderWidth={1}
      borderColor={authUi.glassBorder}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      hoverStyle={{ backgroundColor: authUi.glassHighlight }}
      onPress={onPress}
      aria-label={direction === 'prev' ? 'Previous benefit' : 'Next benefit'}
    >
      <Icon size={16} color="white" />
    </XStack>
  )
}