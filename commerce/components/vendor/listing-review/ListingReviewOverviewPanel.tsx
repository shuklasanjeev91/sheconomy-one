import { Icons, Text, XStack, YStack } from '~/components/ui'
import { StarRating } from '~/commerce/components/StarRating'
import { getShadowStyle, radius } from '~/config/tokens'
import { formatRating } from '~/lib/format'
import { LISTING_REVIEW_UI_COPY } from '~/lib/listing-reviews/listing-reviews-ui.copy'
import type { ListingReviewHubStats } from '~/lib/listing-reviews/listing-reviews-ui.utils'
import {
  computeListingReviewCategoryAverages,
  getListingReviewImprovementCategories,
  LISTING_REVIEW_CATEGORY_LABELS,
} from '~/lib/listing-reviews/listing-reviews-ui.utils'
import type { ListingReviewWithRelations } from '~/lib/listing-reviews/listing-reviews.type'
import { calculateListingReviewStats } from '~/lib/listing-reviews/listing-reviews.utils'
import { LISTING_REVIEW_STATUS } from '~/lib/listing-reviews/listing-reviews.constants'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ListingReviewOverviewPanelProps = {
  ui: AppUiTokens
  stats: ListingReviewHubStats
  reviews: ListingReviewWithRelations[]
  isDesktop: boolean
}

function MiniStat({
  ui,
  label,
  value,
  subtext,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  ui: AppUiTokens
  label: string
  value: string
  subtext?: string
  icon: typeof Icons.Star
  iconBg: string
  iconColor: string
}) {
  return (
    <YStack
      width="100%"
      gap="$2"
      padding="$3"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={11} fontWeight="700" color={ui.textMuted} textTransform="uppercase">
          {label}
        </Text>
        <YStack
          width={28}
          height={28}
          borderRadius={radius.chip}
          backgroundColor={iconBg}
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={14} color={iconColor} />
        </YStack>
      </XStack>
      <Text fontSize={20} fontWeight="800" color={ui.text}>
        {value}
      </Text>
      {subtext ? (
        <Text fontSize={11} color={ui.textMuted} fontWeight="600">
          {subtext}
        </Text>
      ) : null}
    </YStack>
  )
}

function DistributionBar({
  ui,
  stars,
  count,
  percentage,
  total,
}: {
  ui: AppUiTokens
  stars: number
  count: number
  percentage: number
  total: number
}) {
  const width = total > 0 ? (count / total) * 100 : 0

  return (
    <XStack gap="$2" alignItems="center">
      <Text fontSize={12} color={ui.textSecondary} width={12}>
        {stars}
      </Text>
      <Icons.Star size={10} color={ui.textSecondary} fill={ui.textSecondary} />
      <YStack flex={1} height={8} borderRadius={999} backgroundColor={ui.borderSubtle} overflow="hidden">
        <YStack width={`${width}%`} height="100%" backgroundColor={ui.brand} borderRadius={999} />
      </YStack>
      <Text fontSize={11} color={ui.textMuted} width={72} textAlign="right">
        {count} ({percentage.toFixed(1)}%)
      </Text>
    </XStack>
  )
}

export function ListingReviewOverviewPanel({
  ui,
  stats,
  reviews,
  isDesktop,
}: ListingReviewOverviewPanelProps) {
  const approved = reviews.filter((row) => row.review_status === LISTING_REVIEW_STATUS.APPROVED)
  const reviewStats = calculateListingReviewStats(approved)
  const distribution = reviewStats.distribution
  const totalApproved = approved.length
  const categories = computeListingReviewCategoryAverages(reviews)
  const improvements = getListingReviewImprovementCategories(reviews)

  const miniStats = [
    {
      label: LISTING_REVIEW_UI_COPY.overviewAverageRating,
      value: formatRating(stats.averageRating),
      icon: Icons.Star,
      iconBg: '#FEF9C3',
      iconColor: '#CA8A04',
    },
    {
      label: LISTING_REVIEW_UI_COPY.overviewTotalReviews,
      value: String(totalApproved),
      subtext: `${stats.verifiedCount} verified`,
      icon: Icons.MessageSquare,
      iconBg: '#EFF6FF',
      iconColor: '#2563EB',
    },
    {
      label: LISTING_REVIEW_UI_COPY.overviewResponseRate,
      value: `${stats.responseRate}%`,
      icon: Icons.Users,
      iconBg: '#F0FDF4',
      iconColor: '#16A34A',
    },
    {
      label: LISTING_REVIEW_UI_COPY.overviewThisWeek,
      value: `${stats.thisWeekCount} reviews`,
      icon: Icons.Calendar,
      iconBg: '#F5F3FF',
      iconColor: '#7C3AED',
    },
  ] as const

  const categoryEntries = Object.entries(categories).map(([key, value]) => ({
    key,
    label:
      LISTING_REVIEW_CATEGORY_LABELS[key as keyof typeof LISTING_REVIEW_CATEGORY_LABELS] ??
      key.replace(/_/g, ' '),
    value,
  }))

  const miniStatBasis = isDesktop ? '23%' : '48%'

  return (
    <YStack gap="$4" width="100%">
      <XStack gap="$3" flexWrap="wrap" width="100%">
        {miniStats.map((item) => (
          <YStack key={item.label} flexBasis={miniStatBasis} flexGrow={1} minWidth={140} maxWidth="100%">
            <MiniStat ui={ui} {...item} />
          </YStack>
        ))}
      </XStack>

      <XStack
        gap="$4"
        width="100%"
        flexDirection={isDesktop ? 'row' : 'column'}
        alignItems="stretch"
        flexWrap="wrap"
      >
        <YStack
          flex={1}
          minWidth={isDesktop ? 280 : '100%'}
          gap="$3"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          style={getShadowStyle('sm')}
        >
          <Text fontSize={15} fontWeight="800" color={ui.text}>
            {LISTING_REVIEW_UI_COPY.ratingDistribution}
          </Text>
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = distribution[stars as 1 | 2 | 3 | 4 | 5] ?? 0
            const percentage = totalApproved > 0 ? (count / totalApproved) * 100 : 0
            return (
              <DistributionBar
                key={stars}
                ui={ui}
                stars={stars}
                count={count}
                percentage={percentage}
                total={totalApproved}
              />
            )
          })}
        </YStack>

        <YStack
          flex={1}
          minWidth={isDesktop ? 280 : '100%'}
          gap="$3"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          style={getShadowStyle('sm')}
        >
          <Text fontSize={15} fontWeight="800" color={ui.text}>
            {LISTING_REVIEW_UI_COPY.categoryPerformance}
          </Text>
          {categoryEntries.map(({ key, label, value }) => (
            <XStack key={key} alignItems="center" justifyContent="space-between" gap="$3">
              <Text fontSize={13} fontWeight="600" color={ui.textSecondary} flex={1}>
                {label}
              </Text>
              <StarRating rating={value} size={12} />
              <Text fontSize={13} fontWeight="700" color={ui.text} width={32} textAlign="right">
                {formatRating(value)}
              </Text>
            </XStack>
          ))}
        </YStack>
      </XStack>

      {improvements.length ? (
        <YStack
          gap="$2"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          style={getShadowStyle('sm')}
        >
          <Text fontSize={15} fontWeight="800" color={ui.text}>
            {LISTING_REVIEW_UI_COPY.improvementAreas}
          </Text>
          {improvements.map((item) => (
            <YStack key={item.key} gap={4}>
              <XStack alignItems="center" justifyContent="space-between">
                <Text fontSize={13} fontWeight="700" color={ui.text}>
                  {item.label}
                </Text>
                <Text fontSize={13} fontWeight="700" color={ui.starFill}>
                  {formatRating(item.rating)}
                </Text>
              </XStack>
              <YStack height={6} borderRadius={999} backgroundColor={ui.borderSubtle} overflow="hidden">
                <YStack
                  width={`${(item.rating / 5) * 100}%`}
                  height="100%"
                  backgroundColor={ui.starFill}
                  borderRadius={999}
                />
              </YStack>
              <Text fontSize={11} color={ui.textMuted}>
                {LISTING_REVIEW_UI_COPY.improvementHint}
              </Text>
            </YStack>
          ))}
        </YStack>
      ) : null}

      <YStack
        gap="$2"
        padding="$4"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          {LISTING_REVIEW_UI_COPY.quickStats}
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {[
            { label: LISTING_REVIEW_UI_COPY.quickVerified, value: stats.verifiedCount, bg: '#ECFDF5', color: '#059669' },
            { label: LISTING_REVIEW_UI_COPY.quickWithPhotos, value: stats.withPhotosCount, bg: '#EFF6FF', color: '#2563EB' },
            { label: LISTING_REVIEW_UI_COPY.quickResponded, value: stats.respondedCount, bg: '#F5F3FF', color: '#7C3AED' },
            { label: LISTING_REVIEW_UI_COPY.quickThisMonth, value: stats.thisMonthCount, bg: '#FFF7ED', color: '#EA580C' },
          ].map((tile) => (
            <YStack
              key={tile.label}
              flex={1}
              minWidth={120}
              padding="$3"
              borderRadius={radius.chip}
              backgroundColor={tile.bg}
              gap={4}
            >
              <Text fontSize={11} fontWeight="700" color={tile.color}>
                {tile.label}
              </Text>
              <Text fontSize={20} fontWeight="800" color={ui.text}>
                {tile.value}
              </Text>
            </YStack>
          ))}
        </XStack>
      </YStack>
    </YStack>
  )
}
