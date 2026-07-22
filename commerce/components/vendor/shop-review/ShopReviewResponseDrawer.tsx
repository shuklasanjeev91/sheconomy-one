import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { Avatar, Button, Icons, Paragraph, ScrollView, Spinner, Text, TextArea, XStack, YStack } from '~/components/ui'
import { StarRating } from '~/commerce/components/StarRating'
import { getShadowStyle, radius } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import { SHOP_REVIEW_STATUS, SHOP_REVIEW_VALIDATION } from '~/lib/shop-review/shop-review.constants'
import { toFriendlyShopReviewError } from '~/lib/shop-review/shop-review.errors'
import { SHOP_REVIEW_UI_COPY, SHOP_REVIEW_RESPONSE_GUIDELINES } from '~/lib/shop-review/shop-review-ui.copy'
import {
  formatShopReviewResponseCounter,
  getShopReviewReviewerName,
} from '~/lib/shop-review/shop-review-ui.utils'
import type { ShopReviewWithRelations } from '~/lib/shop-review/shop-review.type'
import { formatShopReviewDate } from '~/lib/shop-review/shop-review.utils'
import { parseShopReviewResponseCreate } from '~/lib/shop-review/shop-review.validation'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const PANEL_WIDTH = 560

type ShopReviewResponseDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  review: ShopReviewWithRelations | null
  submitting: boolean
  safeBottom: number
  onClose: () => void
  onSubmit: (responseText: string) => void
  onApprove?: () => void
  onReject?: () => void
  isModerating?: boolean
}

export function ShopReviewResponseDrawer({
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
}: ShopReviewResponseDrawerProps) {
  useLockBodyScroll(open)

  const [responseText, setResponseText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setResponseText('')
    setError(null)
  }, [open, review?.id])

  if (!open || !review) return null

  const reviewerName = getShopReviewReviewerName(review)
  const avatarUrl = review.reviewer_avatar ?? review.profiles?.avatar_url ?? undefined
  const isPending = review.review_status === SHOP_REVIEW_STATUS.PENDING
  const maxLength = SHOP_REVIEW_VALIDATION.RESPONSE_TEXT.MAX_LENGTH

  function handleSubmit() {
    try {
      parseShopReviewResponseCreate({
        review_id: review!.id,
        response_text: responseText.trim(),
        is_public: true,
      })
      setError(null)
      onSubmit(responseText.trim())
    } catch (cause) {
      setError(toFriendlyShopReviewError(cause))
    }
  }

  const panelPositionStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          right: 0,
          bottom: 0,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
        } as const)
      : ({ position: 'absolute' as const, top: 0, right: 0, bottom: 0 } as const)

  return (
    <>
      <YStack
        backgroundColor="rgba(0,0,0,0.5)"
        zIndex={100000}
        cursor="pointer"
        style={overlayBackdropStyle()}
        animation="quick"
        enterStyle={{ opacity: 0 }}
        onPress={submitting || isModerating ? undefined : onClose}
      />
      <YStack
        width={isDesktop ? PANEL_WIDTH : '100%'}
        maxWidth="100%"
        backgroundColor={ui.background}
        borderLeftWidth={isDesktop ? 1 : 0}
        borderLeftColor={ui.borderSubtle}
        zIndex={100001}
        style={{ ...panelPositionStyle, ...getShadowStyle('lg') }}
        animation="quick"
        enterStyle={{ x: isDesktop ? PANEL_WIDTH : 400, opacity: 0.96 }}
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
                {SHOP_REVIEW_UI_COPY.respondDrawerTitle}
              </Text>
              <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
                {SHOP_REVIEW_UI_COPY.respondDrawerSubtitle}
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
                          {SHOP_REVIEW_UI_COPY.verifiedBadge}
                        </Text>
                      </XStack>
                    ) : null}
                  </XStack>
                  <StarRating rating={review.rating} size={12} />
                </YStack>
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
                {formatShopReviewDate(review.created_at)}
              </Text>
            </YStack>

            {!isPending ? (
              <>
                <YStack gap="$2">
                  <XStack alignItems="center" justifyContent="space-between">
                    <Text fontSize={14} fontWeight="800" color={ui.text}>
                      {SHOP_REVIEW_UI_COPY.yourResponse}
                    </Text>
                    <Text fontSize={12} color={ui.textMuted} fontWeight="600">
                      {formatShopReviewResponseCounter(responseText.length)}
                    </Text>
                  </XStack>
                  <TextArea
                    value={responseText}
                    onChangeText={(value) => {
                      if (value.length <= maxLength) setResponseText(value)
                    }}
                    placeholder={SHOP_REVIEW_UI_COPY.responsePlaceholder}
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
                    {SHOP_REVIEW_UI_COPY.responseGuidelinesTitle}
                  </Text>
                  {SHOP_REVIEW_RESPONSE_GUIDELINES.map((item) => (
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
                {SHOP_REVIEW_UI_COPY.reject}
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
                {SHOP_REVIEW_UI_COPY.approve}
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
                {SHOP_REVIEW_UI_COPY.cancel}
              </Button>
              <Button
                flex={1}
                size="$4"
                borderRadius={999}
                tone="primary"
                disabled={submitting || !responseText.trim()}
                icon={submitting ? <Spinner size="small" /> : undefined}
                onPress={handleSubmit}
              >
                {SHOP_REVIEW_UI_COPY.submitResponse}
              </Button>
            </XStack>
          )}
        </YStack>
      </YStack>
    </>
  )
}
