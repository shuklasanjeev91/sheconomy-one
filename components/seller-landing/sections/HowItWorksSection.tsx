import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type HowItWorksSectionProps = {
  onScrollToForm: () => void
}

const STEPS = [
  {
    step: '1',
    icon: 'Shield',
    title: 'Verify & Sign Up',
    description:
      'Enter your email or phone number and verify with a quick OTP. A one-time face check confirms eligibility.',
    color: '#e05c97',
    bg: 'rgba(224,92,151,0.08)',
  },
  {
    step: '2',
    icon: 'Store',
    title: 'Set Up Your Shop',
    description:
      'Choose your category and create your branded storefront in minutes. Your shop URL is ready instantly.',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
  },
  {
    step: '3',
    icon: 'TrendingUp',
    title: 'Start Selling & Growing',
    description:
      'Add products via bulk import or one by one. Start receiving orders and keep 100% of your earnings.',
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.08)',
  },
] as const

export function HowItWorksSection({ onScrollToForm }: HowItWorksSectionProps) {
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
            <Icons.Zap size={14} color={ui.brand} />
            <Text fontSize={12} fontWeight="700" color={ui.brand}>
              How It Works
            </Text>
          </XStack>
          <Text
            fontSize={isDesktop ? 36 : 26}
            fontWeight="900"
            color={ui.text}
            textAlign="center"
          >
            Get Started in 3 Simple Steps
          </Text>
          <Text
            fontSize={isDesktop ? 17 : 14}
            color={ui.textSecondary}
            textAlign="center"
            lineHeight={24}
            maxWidth={540}
          >
            From sign-up to your first sale — the entire journey takes less than 10 minutes.
          </Text>
        </YStack>

        {/* Steps */}
        <XStack
          gap="$4"
          flexDirection={isDesktop ? 'row' : 'column'}
          alignItems="flex-start"
        >
          {STEPS.map((s, i) => {
            const IconComp = (Icons as Record<string, React.ComponentType<{ size: number; color: string }>>)[s.icon]
            return (
              <YStack key={s.step} flex={isDesktop ? 1 : undefined} gap="$3" alignItems="center">
                {/* Step number + icon */}
                <YStack alignItems="center" gap="$2">
                  <YStack
                    width={56}
                    height={56}
                    borderRadius={999}
                    backgroundColor={s.bg}
                    borderWidth={2}
                    borderColor={s.color}
                    alignItems="center"
                    justifyContent="center"
                  >
                    {IconComp && <IconComp size={24} color={s.color} />}
                  </YStack>
                  <YStack
                    width={24}
                    height={24}
                    borderRadius={999}
                    backgroundColor={s.color}
                    alignItems="center"
                    justifyContent="center"
                    marginTop={-16}
                    alignSelf="flex-end"
                    marginRight={isDesktop ? -4 : 0}
                  >
                    <Text fontSize={11} fontWeight="900" color="white">
                      {s.step}
                    </Text>
                  </YStack>
                </YStack>

                <YStack gap="$1.5" alignItems={isDesktop ? 'center' : 'flex-start'}>
                  <Text
                    fontSize={17}
                    fontWeight="800"
                    color={ui.text}
                    textAlign={isDesktop ? 'center' : 'left'}
                  >
                    {s.title}
                  </Text>
                  <Text
                    fontSize={14}
                    color={ui.textSecondary}
                    lineHeight={22}
                    textAlign={isDesktop ? 'center' : 'left'}
                  >
                    {s.description}
                  </Text>
                </YStack>

                {/* Connector line between steps (desktop only) */}
                {isDesktop && i < STEPS.length - 1 && (
                  <YStack
                    position="absolute"
                    right={-('$4' as unknown as number)}
                    top={28}
                    width={40}
                    height={2}
                    backgroundColor={ui.borderSubtle}
                  />
                )}
              </YStack>
            )
          })}
        </XStack>

        {/* CTA */}
        <YStack alignItems="center">
          <Button tone="primary" size="$5" borderRadius={radius.pill} onPress={onScrollToForm}>
            <XStack alignItems="center" gap="$2">
              <Text color="white" fontWeight="800" fontSize={15}>
                Apply as Seller
              </Text>
              <Icons.ArrowRight size={18} color="white" />
            </XStack>
          </Button>
          <Text fontSize={12} color={ui.textMuted} marginTop="$2">
            Takes less than 5 minutes · Free forever on {BRAND_NAME}
          </Text>
        </YStack>
      </YStack>
    </YStack>
  )
}
