import { Icons, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

const PROBLEMS = [
  'Selling on big platforms takes away 30–40% as commission',
  'No community, no learning, no real support',
  'You work hard but profit margins are crushed',
]

const SOLUTIONS = [
  '0% commission — keep every rupee you earn',
  'A women-first community that actually supports you',
  'Learning workshops, co-work spaces, and mentors',
]

export function IntroductionSection() {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  return (
    <YStack
      paddingVertical={isDesktop ? 80 : 56}
      paddingHorizontal={isDesktop ? '$8' : '$4'}
      backgroundColor={ui.surfaceMuted}
    >
      <YStack maxWidth={900} alignSelf="center" width="100%" gap="$8">
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
            <Icons.AlertCircle size={14} color={ui.brand} />
            <Text fontSize={12} fontWeight="700" color={ui.brand}>
              The Problem
            </Text>
          </XStack>
          <Text
            fontSize={isDesktop ? 36 : 26}
            fontWeight="900"
            color={ui.text}
            textAlign="center"
          >
            Why Women Entrepreneurs Struggle Online
          </Text>
          <Text
            fontSize={isDesktop ? 17 : 14}
            color={ui.textSecondary}
            textAlign="center"
            lineHeight={24}
            maxWidth={640}
          >
            The existing platforms were not built for you. They take your money, your data,
            and your independence.
          </Text>
        </YStack>

        {/* Problem / Solution grid */}
        <XStack
          gap="$4"
          flexDirection={isDesktop ? 'row' : 'column'}
        >
          {/* Problems */}
          <YStack
            flex={1}
            backgroundColor={ui.surface}
            borderRadius={radius.card}
            padding="$5"
            gap="$4"
            borderWidth={1}
            borderColor={ui.borderSubtle}
          >
            <XStack alignItems="center" gap="$2">
              <Icons.AlertCircle size={18} color="#ef4444" />
              <Text fontSize={16} fontWeight="800" color="#ef4444">
                The Old Way
              </Text>
            </XStack>
            <YStack gap="$3">
              {PROBLEMS.map((p, i) => (
                <XStack key={i} gap="$3" alignItems="flex-start">
                  <YStack
                    width={20}
                    height={20}
                    borderRadius={99}
                    backgroundColor="rgba(239,68,68,0.1)"
                    alignItems="center"
                    justifyContent="center"
                    marginTop={2}
                    flexShrink={0}
                  >
                    <Icons.X size={12} color="#ef4444" />
                  </YStack>
                  <Text fontSize={14} color={ui.textSecondary} lineHeight={22} flex={1}>
                    {p}
                  </Text>
                </XStack>
              ))}
            </YStack>
          </YStack>

          {/* Solutions */}
          <YStack
            flex={1}
            backgroundColor={ui.roseSurface}
            borderRadius={radius.card}
            padding="$5"
            gap="$4"
            borderWidth={1}
            borderColor="rgba(224,92,151,0.2)"
          >
            <XStack alignItems="center" gap="$2">
              <Icons.Heart size={18} color={ui.brand} />
              <Text fontSize={16} fontWeight="800" color={ui.brand}>
                The SHEconomy Way
              </Text>
            </XStack>
            <YStack gap="$3">
              {SOLUTIONS.map((s, i) => (
                <XStack key={i} gap="$3" alignItems="flex-start">
                  <YStack
                    width={20}
                    height={20}
                    borderRadius={99}
                    backgroundColor="rgba(224,92,151,0.15)"
                    alignItems="center"
                    justifyContent="center"
                    marginTop={2}
                    flexShrink={0}
                  >
                    <Icons.CheckCircle2 size={12} color={ui.brand} />
                  </YStack>
                  <Text fontSize={14} color={ui.text} lineHeight={22} flex={1}>
                    {s}
                  </Text>
                </XStack>
              ))}
            </YStack>
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  )
}
