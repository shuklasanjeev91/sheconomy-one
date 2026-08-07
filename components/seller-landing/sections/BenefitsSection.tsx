import { Icons, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

const BENEFITS = [
  {
    icon: 'Percent',
    title: '0% Commission, Always',
    description:
      'Every rupee you earn stays with you. No hidden charges, no platform cuts — forever.',
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.08)',
  },
  {
    icon: 'Store',
    title: 'Your Own Store',
    description:
      'Get a beautiful, fully-featured storefront with your own URL at sheconomy.in/shops/yourname.',
    color: '#e05c97',
    bg: 'rgba(224,92,151,0.08)',
  },
  {
    icon: 'Users',
    title: 'Supportive Community',
    description:
      'Connect with 5,000+ women entrepreneurs who share, collaborate, and grow together.',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
  },
  {
    icon: 'BookOpen',
    title: 'Learning & Workshops',
    description:
      'Access live workshops, recorded sessions, and expert mentorship tailored for women in business.',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
  },
  {
    icon: 'Building2',
    title: 'Co-Work Spaces',
    description:
      'Book dedicated co-work spaces to run your business without the overhead of a full office.',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
  },
  {
    icon: 'Globe',
    title: 'Nationwide Reach',
    description:
      'Sell to customers across India with integrated logistics and a growing buyer community.',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.08)',
  },
] as const

export function BenefitsSection() {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  return (
    <YStack
      paddingVertical={isDesktop ? 80 : 56}
      paddingHorizontal={isDesktop ? '$8' : '$4'}
      backgroundColor={ui.background}
    >
      <YStack maxWidth={1100} alignSelf="center" width="100%" gap="$8">
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
            <Icons.Sparkles size={14} color={ui.brand} />
            <Text fontSize={12} fontWeight="700" color={ui.brand}>
              Why Choose {BRAND_NAME}
            </Text>
          </XStack>
          <Text
            fontSize={isDesktop ? 36 : 26}
            fontWeight="900"
            color={ui.text}
            textAlign="center"
          >
            Everything You Need to Succeed
          </Text>
          <Text
            fontSize={isDesktop ? 17 : 14}
            color={ui.textSecondary}
            textAlign="center"
            lineHeight={24}
            maxWidth={560}
          >
            Built by women, for women — every feature is designed to help your business grow.
          </Text>
        </YStack>

        {/* Benefits grid */}
        <XStack flexWrap="wrap" gap="$4" justifyContent="center">
          {BENEFITS.map((b) => {
            const IconComp = (Icons as Record<string, React.ComponentType<{ size: number; color: string }>>)[b.icon]
            return (
              <YStack
                key={b.title}
                width={isDesktop ? 'calc(33% - 12px)' as never : '100%'}
                minWidth={isDesktop ? 300 : undefined}
                flex={isDesktop ? undefined : 1}
                backgroundColor={ui.surface}
                borderRadius={radius.card}
                padding="$5"
                gap="$3"
                borderWidth={1}
                borderColor={ui.borderSubtle}
              >
                <YStack
                  width={48}
                  height={48}
                  borderRadius={12}
                  backgroundColor={b.bg}
                  alignItems="center"
                  justifyContent="center"
                >
                  {IconComp && <IconComp size={22} color={b.color} />}
                </YStack>
                <Text fontSize={16} fontWeight="800" color={ui.text}>
                  {b.title}
                </Text>
                <Text fontSize={14} color={ui.textSecondary} lineHeight={22}>
                  {b.description}
                </Text>
              </YStack>
            )
          })}
        </XStack>
      </YStack>
    </YStack>
  )
}
