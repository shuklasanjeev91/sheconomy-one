import { Icons, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

const TRUST_POINTS = [
  {
    icon: 'Percent',
    title: 'Zero Commission, Zero Hidden Fees',
    description:
      'You keep 100% of every sale. No subscription fees, no listing fees, no transaction cuts — ever.',
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.08)',
  },
  {
    icon: 'Heart',
    title: 'Your Business, Your Ownership',
    description:
      'Your store, your customer data, your brand. We never sell your data or compete with your products.',
    color: '#e05c97',
    bg: 'rgba(224,92,151,0.08)',
  },
  {
    icon: 'Shield',
    title: 'Women-First, Always Safe',
    description:
      'Identity verification keeps our community women-only. Your space is protected and trustworthy.',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
  },
] as const

export function TrustSection() {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  return (
    <YStack
      paddingVertical={isDesktop ? 80 : 56}
      paddingHorizontal={isDesktop ? '$8' : '$4'}
      backgroundColor={ui.background}
    >
      <YStack maxWidth={1000} alignSelf="center" width="100%" gap="$8">
        {/* Heading */}
        <YStack gap="$3" alignItems="center">
          <XStack
            alignItems="center"
            gap="$2"
            backgroundColor={ui.roseSurface}
            paddingHorizontal="$3"
            paddingVertical="$1.5"
            borderRadius={radius.pill}
          >
            <Icons.Award size={14} color={ui.brand} />
            <Text fontSize={12} fontWeight="700" color={ui.brand}>
              Our Promise
            </Text>
          </XStack>
          <Text
            fontSize={isDesktop ? 36 : 26}
            fontWeight="900"
            color={ui.text}
            textAlign="center"
          >
            Why You Can Trust {BRAND_NAME}
          </Text>
        </YStack>

        {/* Trust points */}
        <XStack
          gap="$4"
          flexDirection={isDesktop ? 'row' : 'column'}
        >
          {TRUST_POINTS.map((t) => {
            const IconComp = (Icons as Record<string, React.ComponentType<{ size: number; color: string }>>)[t.icon]
            return (
              <YStack
                key={t.title}
                flex={isDesktop ? 1 : undefined}
                backgroundColor={ui.surface}
                borderRadius={radius.card}
                padding="$5"
                gap="$3"
                borderWidth={1}
                borderColor={ui.borderSubtle}
                alignItems="center"
              >
                <YStack
                  width={56}
                  height={56}
                  borderRadius={999}
                  backgroundColor={t.bg}
                  alignItems="center"
                  justifyContent="center"
                >
                  {IconComp && <IconComp size={26} color={t.color} />}
                </YStack>
                <Text fontSize={17} fontWeight="800" color={ui.text} textAlign="center">
                  {t.title}
                </Text>
                <Text fontSize={14} color={ui.textSecondary} lineHeight={22} textAlign="center">
                  {t.description}
                </Text>
              </YStack>
            )
          })}
        </XStack>
      </YStack>
    </YStack>
  )
}
