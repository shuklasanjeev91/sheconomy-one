import { Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import type { DiscountSummaryCard } from '~/lib/discount/discount-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type DiscountSummaryCardsProps = {
  ui: AppUiTokens
  cards: DiscountSummaryCard[]
}

export function DiscountSummaryCards({ ui, cards }: DiscountSummaryCardsProps) {
  return (
    <XStack gap="$3" flexWrap="wrap">
      {cards.map((card) => (
        <YStack
          key={card.id}
          flex={1}
          minWidth={140}
          padding="$4"
          gap="$1"
          borderWidth={1}
          borderColor={ui.borderSubtle}
          borderRadius={radius.card}
          backgroundColor={ui.surface}
        >
          <Text fontSize={12} fontWeight="700" color={ui.textMuted} textTransform="uppercase">
            {card.label}
          </Text>
          <Text fontSize={24} fontWeight="800" color={ui.text}>
            {card.value}
          </Text>
          {card.hint ? (
            <Text fontSize={11} color={ui.textSecondary}>
              {card.hint}
            </Text>
          ) : null}
        </YStack>
      ))}
    </XStack>
  )
}
