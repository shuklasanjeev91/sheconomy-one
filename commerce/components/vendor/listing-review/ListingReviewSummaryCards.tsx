import { Platform } from 'react-native'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { formatRating } from '~/lib/format'
import { LISTING_REVIEW_UI_COPY } from '~/lib/listing-reviews/listing-reviews-ui.copy'
import type { ListingReviewHubStats } from '~/lib/listing-reviews/listing-reviews-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ListingReviewSummaryCardsProps = {
  ui: AppUiTokens
  stats: ListingReviewHubStats
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

export function ListingReviewSummaryCards({ ui, stats, isDesktop }: ListingReviewSummaryCardsProps) {
  const cards = [
    {
      label: LISTING_REVIEW_UI_COPY.summaryTotalReviews,
      value: String(stats.totalCount),
      icon: Icons.MessageSquare,
      iconColor: '#2563EB',
      iconBg: '#EFF6FF',
    },
    {
      label: LISTING_REVIEW_UI_COPY.summaryAverageRating,
      value: formatRating(stats.averageRating),
      icon: Icons.Star,
      iconColor: '#16A34A',
      iconBg: '#F0FDF4',
    },
    {
      label: LISTING_REVIEW_UI_COPY.summaryPending,
      value: String(stats.pendingCount),
      icon: Icons.Clock,
      iconColor: '#EA580C',
      iconBg: '#FFF7ED',
    },
    {
      label: LISTING_REVIEW_UI_COPY.summaryNeedResponse,
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
    <XStack gap="$3" flexWrap="wrap" width="100%">
      {cards.map((card) => (
        <YStack
          key={card.label}
          flexBasis={isDesktop ? '23%' : '48%'}
          flexGrow={1}
          minWidth={isDesktop ? 160 : 140}
          maxWidth="100%"
        >
          <SummaryCard ui={ui} {...card} />
        </YStack>
      ))}
    </XStack>
  )
}
