import { Avatar, Icons, Paragraph, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import type { PublicReview, ReviewSummary } from '~/commerce/lib/reviews'
import { hasVisibleReviews } from '~/commerce/lib/reviews'
import { useAppUi } from '~/lib/theme/useAppUi'

import { RatingSummary } from '~/commerce/components/RatingSummary'
import { SectionTitle } from '~/commerce/components/SectionTitle'
import { StarRating } from '~/commerce/components/StarRating'

type ReviewsSectionProps = {
  title: string
  summary: ReviewSummary
  reviews: PublicReview[]
  isLoading?: boolean
  error?: string | null
  /** When the parent already renders a section heading (e.g. marketplace PDP card). */
  hideTitle?: boolean
}

export function ReviewsSection({
  title,
  summary,
  reviews,
  isLoading,
  error,
  hideTitle = false,
}: ReviewsSectionProps) {
  const ui = useAppUi()
  const heading = hideTitle ? null : <SectionTitle title={title} />

  // Keep rating summary visible while review rows hydrate — never blank the
  // bottom of PDP behind a large spinner.
  if (isLoading && hasVisibleReviews(summary)) {
    // Fall through to render summary; review rows fill in when ready.
  } else if (isLoading && !reviews.length) {
    return (
      <YStack gap="$3" paddingTop="$2">
        {heading}
        <RatingSummary summary={summary} size="sm" />
      </YStack>
    )
  }

  if (!isLoading && !hasVisibleReviews(summary) && !reviews.length) {
    return (
      <YStack gap="$3" paddingTop="$2">
        {heading}
        <Paragraph color={ui.textSecondary} fontSize={14} lineHeight={22} fontWeight="500">
          No reviews yet. Be the first to share your experience after purchase.
        </Paragraph>
      </YStack>
    )
  }

  return (
    <YStack gap="$5" width="100%" paddingTop="$2">
      {heading}

      {error ? (
        <Text color={ui.starFill} fontSize={13}>
          {error}
        </Text>
      ) : null}

      <XStack gap="$6" width="100%" flexWrap="wrap" alignItems="flex-start">
        <YStack minWidth={220} gap="$3" flex={1}>
          <RatingSummary summary={summary} size="lg" showDistribution />
        </YStack>

        <YStack flex={2} minWidth={280} gap="$4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </YStack>
      </XStack>
    </YStack>
  )
}

function ReviewCard({ review }: { review: PublicReview }) {
  const ui = useAppUi()
  const dateLabel = new Date(review.createdAt).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={radius.chip}
      backgroundColor={ui.surface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      style={getShadowStyle('sm')}
    >
      <XStack gap="$3" alignItems="center">
        <Avatar name={review.reviewerName} src={review.reviewerAvatarUrl ?? undefined} size="$3" />
        <YStack flex={1} gap={2}>
          <Text fontSize={14} fontWeight="600" color={ui.text}>
            {review.reviewerName}
          </Text>
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <StarRating rating={review.rating} size={12} />
            <Text fontSize={12} color={ui.textMuted}>
              {dateLabel}
            </Text>
            {review.isVerifiedPurchase ? (
              <XStack gap={4} alignItems="center">
                <Icons.Check size={12} color={ui.success} />
                <Text fontSize={11} color={ui.success} fontWeight="500">
                  Verified purchase
                </Text>
              </XStack>
            ) : null}
          </XStack>
        </YStack>
      </XStack>

      {review.title ? (
        <Text fontSize={14} fontWeight="600" color={ui.text}>
          {review.title}
        </Text>
      ) : null}

      {review.reviewText ? (
        <Paragraph color={ui.text} fontSize={14} lineHeight={22}>
          {review.reviewText}
        </Paragraph>
      ) : null}

      {review.helpfulCount > 0 ? (
        <Text fontSize={12} color={ui.textMuted}>
          {review.helpfulCount} found this helpful
        </Text>
      ) : null}
    </YStack>
  )
}