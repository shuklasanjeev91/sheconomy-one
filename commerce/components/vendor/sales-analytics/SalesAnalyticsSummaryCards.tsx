import { Platform } from 'react-native'

import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { SALES_ANALYTICS_UI_COPY } from '~/lib/sales-analytics/sales-analytics-ui.copy'
import type { SalesAnalyticsSummaryCard } from '~/lib/sales-analytics/sales-analytics-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type SalesAnalyticsSummaryCardsProps = {
  ui: AppUiTokens
  cards: SalesAnalyticsSummaryCard[]
  loading: boolean
  isDesktop: boolean
}

const CARD_ICONS = [
  Icons.DollarSign,
  Icons.ShoppingCart,
  Icons.Package,
  Icons.Box,
  Icons.RotateCcw,
  Icons.RefreshCw,
  Icons.Hash,
] as const

function SummaryCard({
  ui,
  card,
  icon: Icon,
}: {
  ui: AppUiTokens
  card: SalesAnalyticsSummaryCard
  icon: typeof Icons.DollarSign
}) {
  return (
    <YStack
      width="100%"
      gap="$2"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={Platform.OS === 'web' ? getShadowStyle('sm') : undefined}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.6} textTransform="uppercase">
          {card.label}
        </Text>
        <YStack
          width={30}
          height={30}
          borderRadius={radius.chip}
          backgroundColor={ui.roseSurface}
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={15} color={ui.brand} />
        </YStack>
      </XStack>
      <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
        {card.value}
      </Text>
      <Text fontSize={12} color={ui.textMuted}>
        {card.hint}
      </Text>
    </YStack>
  )
}

export function SalesAnalyticsSummaryCards({ ui, cards, loading, isDesktop }: SalesAnalyticsSummaryCardsProps) {
  if (loading) {
    return (
      <YStack minHeight={160} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!cards.length) {
    return (
      <YStack
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        alignItems="center"
      >
        <Text fontSize={13} color={ui.textMuted}>
          {SALES_ANALYTICS_UI_COPY.emptySummary}
        </Text>
      </YStack>
    )
  }

  return (
    <XStack gap="$3" flexWrap="wrap">
      {cards.map((card, index) => (
        <YStack key={card.id} width={isDesktop ? '23%' : '48%'} minWidth={isDesktop ? 180 : 150} flexGrow={1}>
          <SummaryCard ui={ui} card={card} icon={CARD_ICONS[index % CARD_ICONS.length] ?? Icons.BarChart3} />
        </YStack>
      ))}
    </XStack>
  )
}
