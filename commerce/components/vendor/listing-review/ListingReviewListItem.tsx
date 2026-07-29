import { Avatar, Button, Icons, Paragraph, Text, XStack, YStack } from '~/components/ui'
import { StarRating } from '~/commerce/components/StarRating'
import { getShadowStyle, radius } from '~/config/tokens'
import { LISTING_REVIEW_STATUS } from '~/lib/listing-reviews/listing-reviews.constants'
import { LISTING_REVIEW_UI_COPY } from '~/lib/listing-reviews/listing-reviews-ui.copy'
import {
  getListingReviewProductTitle,
  getListingReviewReviewerName,
  getListingReviewStatusBadge,
  LISTING_REVIEW_CATEGORY_FIELDS,
  LISTING_REVIEW_CATEGORY_LABELS,
  listingReviewNeedsResponse,
} from '~/lib/listing-reviews/listing-reviews-ui.utils'
import type { ListingReviewWithRelations } from '~/lib/listing-reviews/listing-reviews.type'
import { formatListingReviewDate } from '~/lib/listing-reviews/listing-reviews.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ListingReviewListItemProps = {
  ui: AppUiTokens
  review: ListingReviewWithRelations
  canReply: boolean
  onRespond: () => void
  onApprove?: () => void
  onReject?: () => void
  isModerating?: boolean
}

function badgeColors(ui: AppUiTokens, tone: 'success' | 'warning' | 'muted' | 'danger') {
  if (tone === 'success') {
    return { backgroundColor: ui.roseSurface, color: ui.brand, borderColor: `${ui.brand}44` }
  }
  if (tone === 'warning') {
    return { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#FCD34D' }
  }
  if (tone === 'danger') {
    return { backgroundColor: '#FEE2E2', color: '#B91C1C', borderColor: '#FECACA' }
  }
  return { backgroundColor: ui.chip, color: ui.textSecondary, borderColor: ui.borderSubtle }
}

const CATEGORY_ICONS = {
  [LISTING_REVIEW_CATEGORY_FIELDS.QUALITY]: Icons.Package,
  [LISTING_REVIEW_CATEGORY_FIELDS.VALUE]: Icons.Banknote,
  [LISTING_REVIEW_CATEGORY_FIELDS.SHIPPING]: Icons.Truck,
  [LISTING_REVIEW_CATEGORY_FIELDS.SERVICE]: Icons.Headphones,
} as const

export function ListingReviewListItem({
  ui,
  review,
  canReply,
  onRespond,
  onApprove,
  onReject,
  isModerating,
}: ListingReviewListItemProps) {
  const badge = getListingReviewStatusBadge(review)
  const badgeStyle = badgeColors(ui, badge.tone)
  const reviewerName = getListingReviewReviewerName(review)
  const productTitle = getListingReviewProductTitle(review)
  const avatarUrl = review.reviewer?.avatar_url ?? undefined
  const needsResponse = listingReviewNeedsResponse(review)
  const isPending = review.review_status === LISTING_REVIEW_STATUS.PENDING

  const categories = Object.values(LISTING_REVIEW_CATEGORY_FIELDS)
    .map((field) => {
      const rating = review[field as keyof ListingReviewWithRelations] as number | null | undefined
      if (!rating) return null
      const Icon = CATEGORY_ICONS[field as keyof typeof CATEGORY_ICONS]
      return {
        field,
        label: LISTING_REVIEW_CATEGORY_LABELS[field as keyof typeof LISTING_REVIEW_CATEGORY_LABELS],
        rating,
        Icon,
      }
    })
    .filter(Boolean) as Array<{
    field: string
    label: string
    rating: number
    Icon: typeof Icons.Package
  }>

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
        <XStack gap="$3" flex={1} minWidth={0} alignItems="center">
          <Avatar name={reviewerName} src={avatarUrl} size="$3" />
          <YStack flex={1} minWidth={0} gap={4}>
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={1}>
                {reviewerName}
              </Text>
              {review.is_verified_purchase ? (
                <XStack
                  alignItems="center"
                  gap={4}
                  paddingHorizontal={8}
                  paddingVertical={2}
                  borderRadius={999}
                  backgroundColor="#ECFDF5"
                >
                  <Icons.Check size={11} color={ui.success} />
                  <Text fontSize={10} fontWeight="700" color={ui.success}>
                    {LISTING_REVIEW_UI_COPY.verifiedBadge}
                  </Text>
                </XStack>
              ) : null}
            </XStack>
            <StarRating rating={review.rating} size={12} />
          </YStack>
        </XStack>

        <YStack
          paddingHorizontal={10}
          paddingVertical={4}
          borderRadius={999}
          borderWidth={1}
          backgroundColor={badgeStyle.backgroundColor}
          borderColor={badgeStyle.borderColor}
        >
          <Text fontSize={10} fontWeight="800" color={badgeStyle.color} letterSpacing={0.3}>
            {badge.label.toUpperCase()}
          </Text>
        </YStack>
      </XStack>

      <XStack alignItems="center" gap="$2" flexWrap="wrap">
        <Icons.Package size={13} color={ui.textMuted} />
        <Text fontSize={12} fontWeight="700" color={ui.textSecondary}>
          {LISTING_REVIEW_UI_COPY.listingLabel}:
        </Text>
        <Text fontSize={12} fontWeight="600" color={ui.text} flex={1} numberOfLines={2}>
          {productTitle}
        </Text>
      </XStack>

      {review.title ? (
        <Text fontSize={15} fontWeight="800" color={ui.text} letterSpacing={-0.2}>
          {review.title}
        </Text>
      ) : null}

      {review.review_text ? (
        <Paragraph color={ui.text} fontSize={14} lineHeight={22}>
          {review.review_text}
        </Paragraph>
      ) : null}

      {categories.length ? (
        <XStack gap="$2" flexWrap="wrap">
          {categories.map(({ field, label, rating, Icon }) => (
            <XStack
              key={field}
              alignItems="center"
              gap={6}
              paddingHorizontal={10}
              paddingVertical={5}
              borderRadius={999}
              backgroundColor={ui.surfaceMuted}
              borderWidth={1}
              borderColor={ui.borderSubtle}
            >
              <Icon size={12} color={ui.textMuted} />
              <Text fontSize={11} fontWeight="600" color={ui.textSecondary}>
                {label}
              </Text>
              <StarRating rating={rating} size={10} />
            </XStack>
          ))}
        </XStack>
      ) : null}

      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <XStack alignItems="center" gap="$3">
          <Text fontSize={12} color={ui.textMuted}>
            {formatListingReviewDate(review.created_at)}
          </Text>
          {(review.helpful_count ?? 0) > 0 ? (
            <XStack alignItems="center" gap={4}>
              <Icons.ThumbsUp size={12} color={ui.textMuted} />
              <Text fontSize={12} color={ui.textMuted}>
                {review.helpful_count}
              </Text>
            </XStack>
          ) : null}
        </XStack>

        <XStack gap="$2" flexWrap="wrap" justifyContent="flex-end">
          {isPending && onApprove && onReject ? (
            <>
              <Button
                size="$3"
                borderRadius={999}
                tone="outline"
                disabled={isModerating}
                onPress={onReject}
              >
                {LISTING_REVIEW_UI_COPY.reject}
              </Button>
              <Button
                size="$3"
                borderRadius={999}
                tone="primary"
                disabled={isModerating}
                onPress={onApprove}
              >
                {LISTING_REVIEW_UI_COPY.approve}
              </Button>
            </>
          ) : null}
          {needsResponse && canReply ? (
            <Button size="$3" borderRadius={999} tone="primary" onPress={onRespond}>
              {LISTING_REVIEW_UI_COPY.respond}
            </Button>
          ) : null}
        </XStack>
      </XStack>
    </YStack>
  )
}
