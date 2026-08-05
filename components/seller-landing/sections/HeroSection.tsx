import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type HeroSectionProps = {
  onScrollToForm: () => void
}

const WHATSAPP_URL = 'https://wa.me/918448991181?text=Hi, I want to sell on Sheconomy'

const NOTIFICATIONS = [
  { text: 'New order received!', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  { text: 'New community member joined', color: '#e05c97', bg: 'rgba(224,92,151,0.10)' },
  { text: 'Your product was liked', color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
  { text: 'Live workshop starting soon', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
]

function AnimatedDashboard({ compact = false }: { compact?: boolean }) {
  const ui = useAppUi()
  const [activeNotif, setActiveNotif] = useState(0)
  const [orderCount, setOrderCount] = useState(127)
  const [earnings, setEarnings] = useState(45230)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveNotif((p) => (p + 1) % NOTIFICATIONS.length)
      setOrderCount((p) => p + Math.floor(Math.random() * 3))
      setEarnings((p) => p + Math.floor(Math.random() * 500))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const notif = NOTIFICATIONS[activeNotif]

  return (
    <YStack
      borderRadius={radius.card}
      overflow="hidden"
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      shadowColor="rgba(0,0,0,0.12)"
      shadowOffset={{ width: 0, height: 8 }}
      shadowRadius={24}
      shadowOpacity={1}
    >
      {/* Header bar */}
      <XStack
        backgroundColor={ui.brand}
        paddingHorizontal="$4"
        paddingVertical="$3"
        alignItems="center"
        justifyContent="space-between"
      >
        <XStack alignItems="center" gap="$2">
          <YStack
            width={compact ? 24 : 32}
            height={compact ? 24 : 32}
            borderRadius={6}
            backgroundColor="rgba(255,255,255,0.2)"
            alignItems="center"
            justifyContent="center"
          >
            <Text color="white" fontWeight="800" fontSize={compact ? 10 : 13}>
              S
            </Text>
          </YStack>
          <Text color="white" fontWeight="600" fontSize={compact ? 12 : 14}>
            Seller Dashboard
          </Text>
        </XStack>
        <XStack alignItems="center" gap="$1.5">
          <YStack
            width={8}
            height={8}
            borderRadius={99}
            backgroundColor="#4ade80"
          />
          <Text color="rgba(255,255,255,0.8)" fontSize={11}>
            Live
          </Text>
        </XStack>
      </XStack>

      <YStack padding={compact ? '$3' : '$4'} gap="$3">
        {/* Stats */}
        <XStack gap="$3">
          <YStack
            flex={1}
            backgroundColor={ui.surfaceMuted}
            borderRadius={radius.chip}
            padding="$3"
            gap="$1"
          >
            <Text fontSize={10} color={ui.textMuted}>
              Today's Orders
            </Text>
            <Text fontSize={compact ? 18 : 22} fontWeight="800" color={ui.text}>
              {orderCount}
            </Text>
            <XStack alignItems="center" gap="$1">
              <Icons.TrendingUp size={10} color="#16a34a" />
              <Text fontSize={10} color="#16a34a">
                +23%
              </Text>
            </XStack>
          </YStack>
          <YStack
            flex={1}
            backgroundColor={ui.surfaceMuted}
            borderRadius={radius.chip}
            padding="$3"
            gap="$1"
          >
            <Text fontSize={10} color={ui.textMuted}>
              Earnings
            </Text>
            <Text fontSize={compact ? 18 : 22} fontWeight="800" color={ui.brand}>
              ₹{earnings.toLocaleString('en-IN')}
            </Text>
            <XStack alignItems="center" gap="$1">
              <Icons.CheckCircle2 size={10} color="#16a34a" />
              <Text fontSize={10} color="#16a34a">
                0% fee
              </Text>
            </XStack>
          </YStack>
        </XStack>

        {/* Live notification */}
        <XStack
          alignItems="center"
          gap="$2"
          backgroundColor={notif.bg}
          borderRadius={radius.chip}
          padding="$2"
        >
          <YStack
            width={32}
            height={32}
            borderRadius={99}
            backgroundColor={notif.bg}
            alignItems="center"
            justifyContent="center"
          >
            <Icons.Bell size={14} color={notif.color} />
          </YStack>
          <YStack flex={1}>
            <Text fontSize={11} fontWeight="600" color={ui.text}>
              {notif.text}
            </Text>
            <Text fontSize={10} color={ui.textMuted}>
              Just now
            </Text>
          </YStack>
        </XStack>

        {/* Community preview */}
        <XStack
          alignItems="center"
          justifyContent="space-between"
          backgroundColor={ui.roseSurface}
          borderRadius={radius.chip}
          padding="$3"
        >
          <XStack alignItems="center" gap="$2">
            <Icons.Users size={14} color={ui.brand} />
            <Text fontSize={11} fontWeight="600" color={ui.text}>
              Community Active
            </Text>
          </XStack>
          <XStack>
            {['👩🏽', '👩🏻', '👩🏾'].map((emoji, i) => (
              <YStack
                key={i}
                width={20}
                height={20}
                borderRadius={99}
                backgroundColor={ui.surface}
                alignItems="center"
                justifyContent="center"
                marginLeft={i === 0 ? 0 : -6}
                borderWidth={1}
                borderColor={ui.borderSubtle}
              >
                <Text fontSize={10}>{emoji}</Text>
              </YStack>
            ))}
            <YStack
              width={20}
              height={20}
              borderRadius={99}
              backgroundColor={ui.brand}
              alignItems="center"
              justifyContent="center"
              marginLeft={-6}
            >
              <Text fontSize={8} color="white" fontWeight="800">
                +99
              </Text>
            </YStack>
          </XStack>
        </XStack>
      </YStack>
    </YStack>
  )
}

export function HeroSection({ onScrollToForm }: HeroSectionProps) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  const openWhatsApp = () => {
    if (Platform.OS === 'web') {
      window.open(WHATSAPP_URL, '_blank')
    }
  }

  return (
    <YStack
      paddingTop={isDesktop ? 120 : 96}
      paddingBottom={isDesktop ? 80 : 56}
      paddingHorizontal={isDesktop ? '$8' : '$4'}
      backgroundColor={ui.background}
    >
      <XStack
        maxWidth={1200}
        alignSelf="center"
        width="100%"
        gap={isDesktop ? '$12' : '$6'}
        flexDirection={isDesktop ? 'row' : 'column'}
        alignItems={isDesktop ? 'center' : 'flex-start'}
      >
        {/* Left content */}
        <YStack flex={isDesktop ? 1 : undefined} gap="$5">
          {/* Badge */}
          <XStack
            alignItems="center"
            gap="$2"
            alignSelf="flex-start"
            backgroundColor={ui.roseSurface}
            paddingHorizontal="$3"
            paddingVertical="$1.5"
            borderRadius={radius.pill}
          >
            <Icons.Sparkles size={14} color={ui.brand} />
            <Text fontSize={12} fontWeight="700" color={ui.brand}>
              For Women Entrepreneurs
            </Text>
          </XStack>

          {/* 0% Commission badge */}
          <XStack
            alignItems="center"
            gap="$3"
            alignSelf="flex-start"
            backgroundColor="rgba(22,163,74,0.08)"
            borderWidth={1.5}
            borderColor="rgba(22,163,74,0.25)"
            borderRadius={radius.card}
            paddingHorizontal="$4"
            paddingVertical="$2.5"
          >
            <YStack
              width={isDesktop ? 48 : 40}
              height={isDesktop ? 48 : 40}
              borderRadius={10}
              backgroundColor="#16a34a"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="white" fontWeight="900" fontSize={isDesktop ? 16 : 14}>
                0%
              </Text>
            </YStack>
            <YStack>
              <Text fontWeight="800" color="#16a34a" fontSize={isDesktop ? 18 : 15}>
                Zero Commission
              </Text>
              <Text fontSize={12} color={ui.textMuted}>
                Keep 100% of your earnings
              </Text>
            </YStack>
          </XStack>

          {/* Headline */}
          <Text
            fontSize={isDesktop ? 52 : 32}
            fontWeight="900"
            color={ui.text}
            lineHeight={isDesktop ? 62 : 40}
          >
            Build, Sell, and Grow Your Business{' '}
            <Text fontSize={isDesktop ? 52 : 32} fontWeight="900" color={ui.brand}>
              Without Paying Any Commission
            </Text>
          </Text>

          {/* Subheading */}
          <Text fontSize={isDesktop ? 18 : 15} color={ui.textSecondary} lineHeight={26}>
            {BRAND_NAME} is a zero-commission ecommerce platform where women entrepreneurs sell
            directly, grow with a supportive community, and access real learning opportunities—all
            in one place.
          </Text>

          {/* CTAs */}
          <XStack gap="$3" flexWrap="wrap">
            <Button
              tone="primary"
              size="$5"
              borderRadius={radius.card}
              onPress={onScrollToForm}
            >
              <XStack alignItems="center" gap="$2">
                <Text color="white" fontWeight="800" fontSize={15}>
                  Create Seller Account
                </Text>
                <Icons.ArrowRight size={18} color="white" />
              </XStack>
            </Button>
            <Button
              tone="outline"
              size="$5"
              borderRadius={radius.card}
              onPress={openWhatsApp}
            >
              <XStack alignItems="center" gap="$2">
                <Icons.MessageCircle size={18} color={ui.brand} />
                <Text fontWeight="700" fontSize={15} color={ui.brand}>
                  Chat on WhatsApp
                </Text>
              </XStack>
            </Button>
          </XStack>

          {/* Stats */}
          <XStack gap="$3" paddingTop="$2">
            {[
              { value: '5K+', label: 'Active Sellers' },
              { value: '50K+', label: 'Happy Customers' },
              { value: '₹10Cr+', label: 'Seller Earnings' },
            ].map((stat) => (
              <YStack
                key={stat.label}
                flex={1}
                backgroundColor={ui.surface}
                borderRadius={radius.card}
                padding="$3"
                borderWidth={1}
                borderColor={ui.borderSubtle}
                alignItems="center"
              >
                <Text fontSize={isDesktop ? 28 : 20} fontWeight="900" color={ui.brand}>
                  {stat.value}
                </Text>
                <Text fontSize={10} color={ui.textMuted} textAlign="center">
                  {stat.label}
                </Text>
              </YStack>
            ))}
          </XStack>

          {/* Mobile dashboard */}
          {!isDesktop && (
            <YStack marginTop="$4">
              <AnimatedDashboard compact />
            </YStack>
          )}
        </YStack>

        {/* Desktop dashboard showcase */}
        {isDesktop && (
          <YStack flex={1} maxWidth={480}>
            <AnimatedDashboard />
          </YStack>
        )}
      </XStack>
    </YStack>
  )
}
