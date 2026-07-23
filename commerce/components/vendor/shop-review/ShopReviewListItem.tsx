import { Avatar, Button, Icons, Paragraph, Text, XStack, YStack } from '~/components/ui'
import { StarRating } from '~/commerce/components/StarRating'
import { getShadowStyle, radius } from '~/config/tokens'
import { SHOP_REVIEW_CATEGORY_LABELS, SHOP_REVIEW_CATEGORY_FIELDS } from '~/lib/shop-review/shop-review.constants'
import { SHOP_REVIEW_UI_COPY } from '~/lib/shop-review/shop-review-ui.copy'
import {
  getShopReviewReviewerName,
  getShopReviewStatusBadge,
  reviewNeedsResponse,
} from '~/lib/shop-review/shop-review-ui.utils'
import type { ShopReviewWithRelations } from '~/lib/shop-review/shop-review.type'
import { formatShopReviewDate } from '~/lib/shop-review/shop-review.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ShopReviewListItemProps = {
  ui: AppUiTokens
  review: ShopReviewWithRelations
  canRespond: boolean
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
  [SHOP_REVIEW_CATEGORY_FIELDS.PRODUCT_QUALITY]: Icons.Package,
  [SHOP_REVIEW_CATEGORY_FIELDS.CUSTOMER_SERVICE]: Icons.Headphones,
  [SHOP_REVIEW_CATEGORY_FIELDS.SHIPPING_SPEED]: Icons.Truck,
  [SHOP_REVIEW_CATEGORY_FIELDS.VALUE_FOR_MONEY]: Icons.Banknote,
} as const

export function ShopReviewListItem({
  ui,
  review,
  canRespond,
  onRespond,
  onApprove,
  onReject,
  isModerating,
}: ShopReviewListItemProps) {
  const badge = getShopReviewStatusBadge(review)
  const badgeStyle = badgeColors(ui, badge.tone)
  const reviewerName = getShopReviewReviewerName(review)
  const avatarUrl = review.reviewer_avatar ?? review.profiles?.avatar_url ?? undefined
  const needsResponse = reviewNeedsResponse(review)
  const isPending = review.review_status === 'pending'

  const categories = Object.values(SHOP_REVIEW_CATEGORY_FIELDS)
    .map((field) => {
      const rating = review[field as keyof ShopReviewWithRelations] as number | null | undefined
      if (!rating) return null
      const Icon = CATEGORY_ICONS[field as keyof typeof CATEGORY_ICONS]
      return {
        field,
        label: SHOP_REVIEW_CATEGORY_LABELS[field as keyof typeof SHOP_REVIEW_CATEGORY_LABELS],
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
                    {SHOP_REVIEW_UI_COPY.verifiedBadge}
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
            {formatShopReviewDate(review.created_at)}
          </Text>
          {(review.helpful_count ?? 0) > 0 ? (
            <XStack alignItems="center" gap={4}>
              <Icons.ThumbsUp size={12} color={ui.textMuted} />
              <Text fontSize={12} color={ui.textMuted}>
                {review.helpful_count}
              </Text>
            </XStack>
          ) : null}
          {(review.not_helpful_count ?? 0) > 0 ? (
            <XStack alignItems="center" gap={4}>
              <Icons.ThumbsDown size={12} color={ui.textMuted} />
              <Text fontSize={12} color={ui.textMuted}>
                {review.not_helpful_count}
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
                {SHOP_REVIEW_UI_COPY.reject}
              </Button>
              <Button
                size="$3"
                borderRadius={999}
                tone="primary"
                disabled={isModerating}
                onPress={onApprove}
              >
                {SHOP_REVIEW_UI_COPY.approve}
              </Button>
            </>
          ) : null}
          {needsResponse && canRespond ? (
            <Button size="$3" borderRadius={999} tone="primary" onPress={onRespond}>
              {SHOP_REVIEW_UI_COPY.respond}
            </Button>
          ) : null}
        </XStack>
      </XStack>
    </YStack>
  )
}
