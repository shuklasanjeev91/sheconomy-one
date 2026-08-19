import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import {
  Avatar,
  Button,
  Icons,
  Paragraph,
  ScrollView,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
} from '~/components/ui'
import { ViewportOverlay } from '~/components/layout/ViewportOverlay'
import { StarRating } from '~/commerce/components/StarRating'
import { radius } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { overlayBackdropStyle, overlayPanelStyle } from '~/lib/layout/styles'
import { LISTING_REVIEW_STATUS, LISTING_REVIEW_VALIDATION } from '~/lib/listing-reviews/listing-reviews.constants'
import { toFriendlyListingReviewError } from '~/lib/listing-reviews/listing-reviews.errors'
import {
  LISTING_REVIEW_UI_COPY,
  LISTING_REVIEW_RESPONSE_GUIDELINES,
} from '~/lib/listing-reviews/listing-reviews-ui.copy'
import {
  formatListingReviewReplyCounter,
  getListingReviewProductTitle,
  getListingReviewReviewerName,
} from '~/lib/listing-reviews/listing-reviews-ui.utils'
import type { ListingReviewWithRelations } from '~/lib/listing-reviews/listing-reviews.type'
import { formatListingReviewDate } from '~/lib/listing-reviews/listing-reviews.utils'
import { parseListingReviewReplyCreate } from '~/lib/listing-reviews/listing-reviews.validation'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const PANEL_WIDTH = 560

type ListingReviewResponseDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  review: ListingReviewWithRelations | null
  submitting: boolean
  safeBottom: number
  onClose: () => void
  onSubmit: (replyText: string) => void
  onApprove?: () => void
  onReject?: () => void
  isModerating?: boolean
}

export function ListingReviewResponseDrawer({
  ui,
  open,
  isDesktop,
  review,
  submitting,
  safeBottom,
  onClose,
  onSubmit,
  onApprove,
  onReject,
  isModerating,
}: ListingReviewResponseDrawerProps) {
  useLockBodyScroll(open)

  const [replyText, setReplyText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setReplyText('')
    setError(null)
  }, [open, review?.id])

  if (!open || !review) return null

  const reviewerName = getListingReviewReviewerName(review)
  const productTitle = getListingReviewProductTitle(review)
  const avatarUrl = review.reviewer?.avatar_url ?? undefined
  const isPending = review.review_status === LISTING_REVIEW_STATUS.PENDING
  const maxLength = LISTING_REVIEW_VALIDATION.REPLY_TEXT.MAX_LENGTH

  function handleSubmit() {
    try {
      parseListingReviewReplyCreate({
        review_id: review!.id,
        reply_text: replyText.trim(),
        is_public: true,
      })
      setError(null)
      onSubmit(replyText.trim())
    } catch (cause) {
      setError(toFriendlyListingReviewError(cause))
    }
  }

  const panelPositionStyle = overlayPanelStyle()

  return (
    <ViewportOverlay>
      <YStack
        backgroundColor="rgba(0,0,0,0.5)"
        zIndex={100000}
        cursor="pointer"
        style={overlayBackdropStyle()}
        onPress={submitting || isModerating ? undefined : onClose}
      />
      <YStack
        width={isDesktop ? PANEL_WIDTH : '100%'}
        maxWidth="100%"
        backgroundColor={ui.background}
        borderLeftWidth={isDesktop ? 1 : 0}
        borderLeftColor={ui.borderSubtle}
        zIndex={100001}
        style={panelPositionStyle}
      >
        <XStack
          alignItems="flex-start"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
          gap="$3"
        >
          <XStack gap="$3" flex={1} minWidth={0}>
            <YStack
              width={40}
              height={40}
              borderRadius={radius.chip}
              backgroundColor={ui.roseSurface}
              alignItems="center"
              justifyContent="center"
            >
              <Icons.MessageSquare size={20} color={ui.brand} />
            </YStack>
            <YStack flex={1} minWidth={0} gap={2}>
              <Text fontSize={18} fontWeight="800" color={ui.text} letterSpacing={-0.3}>
                {LISTING_REVIEW_UI_COPY.respondDrawerTitle}
              </Text>
              <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
                {LISTING_REVIEW_UI_COPY.respondDrawerSubtitle}
              </Text>
            </YStack>
          </XStack>
          <YStack
            width={36}
            height={36}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            cursor={submitting || isModerating ? 'default' : 'pointer'}
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            onPress={submitting || isModerating ? undefined : onClose}
          >
            <Icons.X size={18} color={ui.textMuted} />
          </YStack>
        </XStack>

        <ScrollView flex={1} contentContainerStyle={{ paddingBottom: safeBottom + 24 }}>
          <YStack gap="$4" padding="$4">
            <YStack
              gap="$3"
              padding="$4"
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              <XStack gap="$3" alignItems="center">
                <Avatar name={reviewerName} src={avatarUrl} size="$3" />
                <YStack flex={1} gap={4}>
                  <XStack alignItems="center" gap="$2" flexWrap="wrap">
                    <Text fontSize={14} fontWeight="700" color={ui.text}>
                      {reviewerName}
                    </Text>
                    {review.is_verified_purchase ? (
                      <XStack alignItems="center" gap={4}>
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

              <XStack alignItems="center" gap="$2">
                <Icons.Package size={13} color={ui.textMuted} />
                <Text fontSize={12} color={ui.textSecondary} fontWeight="600" numberOfLines={2}>
                  {productTitle}
                </Text>
              </XStack>

              {review.title ? (
                <Text fontSize={15} fontWeight="800" color={ui.text}>
                  {review.title}
                </Text>
              ) : null}

              {review.review_text ? (
                <Paragraph color={ui.text} fontSize={14} lineHeight={22}>
                  {review.review_text}
                </Paragraph>
              ) : null}

              <Text fontSize={12} color={ui.textMuted}>
                {formatListingReviewDate(review.created_at)}
              </Text>
            </YStack>

            {!isPending ? (
              <>
                <YStack gap="$2">
                  <XStack alignItems="center" justifyContent="space-between">
                    <Text fontSize={14} fontWeight="800" color={ui.text}>
                      {LISTING_REVIEW_UI_COPY.yourResponse}
                    </Text>
                    <Text fontSize={12} color={ui.textMuted} fontWeight="600">
                      {formatListingReviewReplyCounter(replyText.length)}
                    </Text>
                  </XStack>
                  <TextArea
                    value={replyText}
                    onChangeText={(value) => {
                      if (value.length <= maxLength) setReplyText(value)
                    }}
                    placeholder={LISTING_REVIEW_UI_COPY.responsePlaceholder}
                    minHeight={140}
                    borderRadius={radius.chip}
                    borderWidth={1}
                    borderColor={error ? ui.starFill : ui.brand}
                    backgroundColor={ui.surface}
                    padding="$3"
                  />
                  {error ? (
                    <Text fontSize={12} color={ui.starFill}>
                      {error}
                    </Text>
                  ) : null}
                </YStack>

                <YStack
                  gap="$2"
                  padding="$4"
                  borderRadius={radius.card}
                  backgroundColor="#EFF6FF"
                  borderWidth={1}
                  borderColor="#BFDBFE"
                >
                  <Text fontSize={13} fontWeight="800" color="#1D4ED8">
                    {LISTING_REVIEW_UI_COPY.responseGuidelinesTitle}
                  </Text>
                  {LISTING_REVIEW_RESPONSE_GUIDELINES.map((item) => (
                    <XStack key={item} gap="$2" alignItems="flex-start">
                      <Text fontSize={13} color="#1E40AF">
                        •
                      </Text>
                      <Text fontSize={13} color="#1E40AF" lineHeight={20} flex={1}>
                        {item}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              </>
            ) : null}
          </YStack>
        </ScrollView>

        <YStack
          paddingHorizontal="$4"
          paddingTop="$3"
          paddingBottom={safeBottom + 12}
          borderTopWidth={1}
          borderTopColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          gap="$2"
        >
          {isPending && onApprove && onReject ? (
            <XStack gap="$2">
              <Button
                flex={1}
                size="$4"
                borderRadius={999}
                tone="outline"
                disabled={isModerating || submitting}
                onPress={onReject}
              >
                {LISTING_REVIEW_UI_COPY.reject}
              </Button>
              <Button
                flex={1}
                size="$4"
                borderRadius={999}
                tone="primary"
                disabled={isModerating || submitting}
                icon={isModerating ? <Spinner size="small" /> : undefined}
                onPress={onApprove}
              >
                {LISTING_REVIEW_UI_COPY.approve}
              </Button>
            </XStack>
          ) : (
            <XStack gap="$2">
              <Button
                flex={1}
                size="$4"
                borderRadius={999}
                tone="outline"
                disabled={submitting}
                onPress={onClose}
              >
                {LISTING_REVIEW_UI_COPY.cancel}
              </Button>
              <Button
                flex={1}
                size="$4"
                borderRadius={999}
                tone="primary"
                disabled={submitting || !replyText.trim()}
                icon={submitting ? <Spinner size="small" /> : undefined}
                onPress={handleSubmit}
              >
                {LISTING_REVIEW_UI_COPY.submitResponse}
              </Button>
            </XStack>
          )}
        </YStack>
      </YStack>
    </ViewportOverlay>
  )
}
