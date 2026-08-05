import { Icons, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

const CRITERIA = [
  'You identify as a woman entrepreneur',
  'You have a product or service to sell',
  'You are based in India (sellers) or globally (buyers)',
  'You agree to our community guidelines',
  'You are ready to grow with a supportive community',
]

const CATEGORIES = [
  { emoji: '👗', name: 'Fashion' },
  { emoji: '💄', name: 'Beauty' },
  { emoji: '🪡', name: 'Handmade' },
  { emoji: '🏠', name: 'Home Décor' },
  { emoji: '💍', name: 'Jewelry' },
  { emoji: '🍱', name: 'Food & Bev' },
  { emoji: '🎨', name: 'Art' },
  { emoji: '📦', name: 'Other' },
]

export function EligibilitySection() {
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
            <Icons.Shield size={14} color={ui.brand} />
            <Text fontSize={12} fontWeight="700" color={ui.brand}>
              Who Can Join
            </Text>
          </XStack>
          <Text
            fontSize={isDesktop ? 36 : 26}
            fontWeight="900"
            color={ui.text}
            textAlign="center"
          >
            Are You Eligible?
          </Text>
          <Text
            fontSize={isDesktop ? 17 : 14}
            color={ui.textSecondary}
            textAlign="center"
            lineHeight={24}
            maxWidth={560}
          >
            {BRAND_NAME} is a women-first platform. Here's who can become a seller.
          </Text>
        </YStack>

        {/* Criteria */}
        <YStack
          backgroundColor={ui.surface}
          borderRadius={radius.card}
          padding="$5"
          gap="$3"
          borderWidth={1}
          borderColor={ui.borderSubtle}
        >
          {CRITERIA.map((c, i) => (
            <XStack key={i} gap="$3" alignItems="flex-start">
              <YStack
                width={22}
                height={22}
                borderRadius={99}
                backgroundColor={ui.roseSurface}
                alignItems="center"
                justifyContent="center"
                marginTop={2}
                flexShrink={0}
              >
                <Icons.CheckCircle2 size={13} color={ui.brand} />
              </YStack>
              <Text fontSize={14} color={ui.text} lineHeight={22} flex={1}>
                {c}
              </Text>
            </XStack>
          ))}
        </YStack>

        {/* Category tiles */}
        <YStack gap="$3">
          <Text fontSize={16} fontWeight="800" color={ui.text} textAlign="center">
            What Can You Sell?
          </Text>
          <XStack flexWrap="wrap" gap="$3" justifyContent="center">
            {CATEGORIES.map((cat) => (
              <YStack
                key={cat.name}
                backgroundColor={ui.surface}
                borderRadius={radius.card}
                paddingHorizontal="$4"
                paddingVertical="$3"
                alignItems="center"
                gap="$1"
                borderWidth={1}
                borderColor={ui.borderSubtle}
                minWidth={80}
              >
                <Text fontSize={22}>{cat.emoji}</Text>
                <Text fontSize={11} fontWeight="600" color={ui.textSecondary}>
                  {cat.name}
                </Text>
              </YStack>
            ))}
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  )
}
