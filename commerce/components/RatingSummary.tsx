import { Icons, Text, XStack, YStack } from '~/components/ui'
import { formatRating } from '~/lib/format'
import type { ReviewSummary } from '~/commerce/lib/reviews'
import { hasVisibleReviews } from '~/commerce/lib/reviews'
import { useAppUi } from '~/lib/theme/useAppUi'

import { StarRating } from './StarRating'

type RatingSummaryProps = {
  summary: ReviewSummary
  label?: string
  size?: 'sm' | 'md' | 'lg'
  showDistribution?: boolean
}

export function RatingSummary({
  summary,
  label,
  size = 'md',
  showDistribution = false,
}: RatingSummaryProps) {
  const ui = useAppUi()

  if (!hasVisibleReviews(summary)) return null

  const starSize = size === 'lg' ? 16 : size === 'sm' ? 12 : 14
  const scoreSize = size === 'lg' ? 28 : size === 'sm' ? 14 : 18

  return (
    <YStack gap="$3" width="100%">
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <StarRating rating={summary.averageRating ?? 0} size={starSize} />
        <Text fontSize={scoreSize} fontWeight="600" color={ui.text} lineHeight={scoreSize + 4}>
          {formatRating(summary.averageRating)}
        </Text>
        <Text fontSize={size === 'sm' ? 12 : 14} color={ui.textSecondary}>
          ({summary.totalReviews.toLocaleString()} {summary.totalReviews === 1 ? 'review' : 'reviews'})
        </Text>
        {label ? (
          <Text fontSize={12} color={ui.textMuted}>
            {label}
          </Text>
        ) : null}
      </XStack>

      {showDistribution ? (
        <YStack gap={6} width="100%" maxWidth={360}>
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = summary.distribution[stars as 1 | 2 | 3 | 4 | 5]
            const width = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0

            return (
              <XStack key={stars} gap="$2" alignItems="center">
                <Text fontSize={12} color={ui.textSecondary} width={12}>
                  {stars}
                </Text>
                <Icons.Star size={10} color={ui.textSecondary} fill={ui.textSecondary} />
                <YStack flex={1} height={8} borderRadius={999} backgroundColor={ui.borderSubtle} overflow="hidden">
                  <YStack width={`${width}%`} height="100%" backgroundColor={ui.text} borderRadius={999} />
                </YStack>
                <Text fontSize={12} color={ui.textMuted} width={28} textAlign="right">
                  {count}
                </Text>
              </XStack>
            )
          })}
        </YStack>
      ) : null}
    </YStack>
  )
}