import { Platform } from 'react-native'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { formatRating } from '~/lib/format'
import { SHOP_REVIEW_UI_COPY } from '~/lib/shop-review/shop-review-ui.copy'
import type { ShopReviewHubStats } from '~/lib/shop-review/shop-review-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ShopReviewSummaryCardsProps = {
  ui: AppUiTokens
  stats: ShopReviewHubStats
  isDesktop: boolean
}

function SummaryCard({
  ui,
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  ui: AppUiTokens
  label: string
  value: string
  icon: typeof Icons.MessageSquare
  iconColor: string
  iconBg: string
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
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.6} textTransform="uppercase">
          {label}
        </Text>
        <YStack
          width={30}
          height={30}
          borderRadius={radius.chip}
          backgroundColor={iconBg}
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={15} color={iconColor} />
        </YStack>
      </XStack>
      <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
        {value}
      </Text>
    </YStack>
  )
}

export function ShopReviewSummaryCards({ ui, stats, isDesktop }: ShopReviewSummaryCardsProps) {
  const cards = [
    {
      label: SHOP_REVIEW_UI_COPY.summaryTotalReviews,
      value: String(stats.totalCount),
      icon: Icons.MessageSquare,
      iconColor: '#2563EB',
      iconBg: '#EFF6FF',
    },
    {
      label: SHOP_REVIEW_UI_COPY.summaryAverageRating,
      value: formatRating(stats.averageRating),
      icon: Icons.Star,
      iconColor: '#16A34A',
      iconBg: '#F0FDF4',
    },
    {
      label: SHOP_REVIEW_UI_COPY.summaryPending,
      value: String(stats.pendingCount),
      icon: Icons.Clock,
      iconColor: '#EA580C',
      iconBg: '#FFF7ED',
    },
    {
      label: SHOP_REVIEW_UI_COPY.summaryNeedResponse,
      value: String(stats.needResponseCount),
      icon: Icons.Users,
      iconColor: '#EA580C',
      iconBg: '#FFF7ED',
    },
  ] as const

  if (Platform.OS !== 'web') {
    return (
      <XStack gap="$3" flexWrap="wrap" width="100%">
        {cards.map((card) => (
          <XStack key={card.label} flexBasis="45%" flexGrow={1} minWidth={140}>
            <SummaryCard ui={ui} {...card} />
          </XStack>
        ))}
      </XStack>
    )
  }

  return (
    <YStack
      width="100%"
      style={{
        display: 'grid',
        gridTemplateColumns: isDesktop ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
        gap: 12,
      }}
    >
      {cards.map((card) => (
        <YStack key={card.label} width="100%" minWidth={0}>
          <SummaryCard ui={ui} {...card} />
        </YStack>
      ))}
    </YStack>
  )
}
