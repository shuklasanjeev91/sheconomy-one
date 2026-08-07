import { useEffect } from 'react'
import { Platform, ScrollView } from 'react-native'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

const TESTIMONIALS = [
  {
    name: 'Meera Sharma',
    location: 'Delhi',
    emoji: '👩🏽',
    quote:
      'I was paying 35% commission on another platform. Since moving to SHEconomy I keep everything I earn. My income doubled in 3 months!',
    category: 'Fashion & Clothing',
    earnings: '₹1.2L/month',
  },
  {
    name: 'Priya Nair',
    location: 'Kerala',
    emoji: '👩🏻',
    quote:
      'The community here is incredible. Other sellers helped me improve my product photos and my sales jumped within a week.',
    category: 'Handmade & Crafts',
    earnings: '₹45K/month',
  },
  {
    name: 'Sunita Patel',
    location: 'Gujarat',
    emoji: '👩🏾',
    quote:
      'The workshops are life-changing. I learned social media marketing, and now I run ads myself. Best decision I ever made.',
    category: 'Jewelry & Accessories',
    earnings: '₹85K/month',
  },
  {
    name: 'Anjali Reddy',
    location: 'Hyderabad',
    emoji: '👩',
    quote:
      'Setting up my shop took literally 10 minutes. The bulk import tool saved me days of manual work. Absolutely love this platform.',
    category: 'Beauty & Skincare',
    earnings: '₹60K/month',
  },
  {
    name: 'Divya Menon',
    location: 'Bangalore',
    emoji: '👩🏼',
    quote:
      'SHEconomy gave me the confidence to price my art properly. No pressure from commissions — just pure creative freedom.',
    category: 'Art & Design',
    earnings: '₹32K/month',
  },
  {
    name: 'Fatima Khan',
    location: 'Mumbai',
    emoji: '👩🏽‍🦱',
    quote:
      'I launched my homemade pickle brand here. Within two months I had 200+ repeat customers. The platform really works!',
    category: 'Food & Gourmet',
    earnings: '₹55K/month',
  },
]

const MARQUEE_CSS_ID = 'sheconomy-testimonials-marquee'

function useMarqueeStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    if (document.getElementById(MARQUEE_CSS_ID)) return
    const el = document.createElement('style')
    el.id = MARQUEE_CSS_ID
    el.textContent = `
      @keyframes she-marquee {
        0%   { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .she-marquee-track {
        display: flex;
        flex-direction: row;
        animation: she-marquee 40s linear infinite;
        will-change: transform;
      }
      .she-marquee-track:hover {
        animation-play-state: paused;
      }
    `
    document.head.appendChild(el)
    return () => {
      const existing = document.getElementById(MARQUEE_CSS_ID)
      if (existing) existing.remove()
    }
  }, [])
}

interface CardProps {
  t: (typeof TESTIMONIALS)[number]
  ui: ReturnType<typeof useAppUi>
}

function TestimonialCard({ t, ui }: CardProps) {
  return (
    <YStack
      width={340}
      flexShrink={0}
      backgroundColor={ui.surface}
      borderRadius={radius.card}
      padding="$4"
      gap="$3"
      borderWidth={1}
      borderColor={ui.borderSubtle}
      marginRight="$3"
    >
      {/* Stars */}
      <XStack gap="$0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Icons.Star key={i} size={13} color="#f59e0b" />
        ))}
      </XStack>

      {/* Quote */}
      <Text
        fontSize={13}
        color={ui.text}
        lineHeight={20}
        fontStyle="italic"
        numberOfLines={4}
      >
        "{t.quote}"
      </Text>

      {/* Footer */}
      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap="$2">
          <YStack
            width={36}
            height={36}
            borderRadius={999}
            backgroundColor={ui.roseSurface}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={18}>{t.emoji}</Text>
          </YStack>
          <YStack>
            <Text fontSize={13} fontWeight="800" color={ui.text}>
              {t.name}
            </Text>
            <Text fontSize={11} color={ui.textMuted}>
              {t.location} · {t.category}
            </Text>
          </YStack>
        </XStack>
        <YStack
          backgroundColor="rgba(22,163,74,0.08)"
          borderRadius={radius.chip}
          paddingHorizontal="$2"
          paddingVertical="$1"
        >
          <Text fontSize={11} fontWeight="800" color="#16a34a">
            {t.earnings}
          </Text>
        </YStack>
      </XStack>
    </YStack>
  )
}

export function TestimonialsSection() {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  useMarqueeStyles()

  // Duplicate for seamless loop
  const doubled = [...TESTIMONIALS, ...TESTIMONIALS]

  return (
    <YStack
      paddingVertical={isDesktop ? 80 : 56}
      backgroundColor={ui.surfaceMuted}
      overflow="hidden"
    >
      {/* Heading */}
      <YStack
        gap="$3"
        alignItems="center"
        paddingHorizontal={isDesktop ? '$8' : '$4'}
        marginBottom="$8"
      >
        <XStack
          alignItems="center"
          gap="$2"
          backgroundColor={ui.roseSurface}
          paddingHorizontal="$3"
          paddingVertical="$1.5"
          borderRadius={radius.pill}
        >
          <Icons.Star size={14} color={ui.brand} />
          <Text fontSize={12} fontWeight="700" color={ui.brand}>
            Success Stories
          </Text>
        </XStack>
        <Text
          fontSize={isDesktop ? 36 : 26}
          fontWeight="900"
          color={ui.text}
          textAlign="center"
        >
          Women Who Are Winning on {BRAND_NAME}
        </Text>
        <Text
          fontSize={isDesktop ? 17 : 14}
          color={ui.textSecondary}
          textAlign="center"
          lineHeight={24}
        >
          Real sellers. Real earnings. Real stories.
        </Text>
      </YStack>

      {/* Marquee — web */}
      {Platform.OS === 'web' && (
        <YStack overflow="hidden" position="relative">
          {/* Fade edges */}
          <YStack
            position="absolute"
            top={0}
            left={0}
            bottom={0}
            width={80}
            zIndex={2}
            pointerEvents="none"
            style={
              {
                background:
                  `linear-gradient(to right, ${ui.surfaceMuted}, transparent)`,
              } as React.CSSProperties
            }
          />
          <YStack
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            width={80}
            zIndex={2}
            pointerEvents="none"
            style={
              {
                background:
                  `linear-gradient(to left, ${ui.surfaceMuted}, transparent)`,
              } as React.CSSProperties
            }
          />
          {/* Scrolling track */}
          <div className="she-marquee-track" style={{ paddingLeft: 16, paddingRight: 16 }}>
            {doubled.map((t, i) => (
              <TestimonialCard key={i} t={t} ui={ui} />
            ))}
          </div>
        </YStack>
      )}

      {/* Horizontal scroll — native */}
      {Platform.OS !== 'web' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        >
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={i} t={t} ui={ui} />
          ))}
        </ScrollView>
      )}
    </YStack>
  )
}
