import { Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { SHOP_REVIEW_UI_COPY } from '~/lib/shop-review/shop-review-ui.copy'
import { shopReviewSearchResultsCount } from '~/lib/shop-review/shop-review-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ShopReviewSearchFieldProps = {
  ui: AppUiTokens
  value: string
  onChange: (value: string) => void
  resultCount: number
  totalCount: number
}

export function ShopReviewSearchField({
  ui,
  value,
  onChange,
  resultCount,
  totalCount,
}: ShopReviewSearchFieldProps) {
  const hasQuery = value.trim().length > 0

  return (
    <YStack gap="$1.5" width="100%">
      <XStack
        alignItems="center"
        gap="$2"
        paddingHorizontal="$3"
        borderRadius={radius.chip}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <Icons.Search size={16} color={ui.textMuted} />
        <Input
          flex={1}
          unstyled
          value={value}
          onChangeText={onChange}
          placeholder={SHOP_REVIEW_UI_COPY.searchPlaceholder}
          backgroundColor="transparent"
          borderWidth={0}
          paddingVertical="$2.5"
        />
        {hasQuery ? (
          <YStack cursor="pointer" onPress={() => onChange('')}>
            <Icons.X size={16} color={ui.textMuted} />
          </YStack>
        ) : null}
      </XStack>
      {hasQuery ? (
        <Text fontSize={11.5} color={ui.textMuted} fontWeight="600">
          {shopReviewSearchResultsCount(resultCount, totalCount)}
        </Text>
      ) : null}
    </YStack>
  )
}
