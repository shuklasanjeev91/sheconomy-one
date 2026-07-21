import { Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { PAYMENT_UI_COPY, paymentSearchResultsCount } from '~/lib/payment/payment-ui.copy'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type PaymentProviderSearchFieldProps = {
  ui: AppUiTokens
  value: string
  onChange: (value: string) => void
  resultCount?: number
  totalCount?: number
}

export function PaymentProviderSearchField({
  ui,
  value,
  onChange,
  resultCount,
  totalCount,
}: PaymentProviderSearchFieldProps) {
  const showCount =
    value.trim().length > 0 &&
    typeof resultCount === 'number' &&
    typeof totalCount === 'number'

  return (
    <YStack gap="$1.5" width="100%">
      <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
        {PAYMENT_UI_COPY.searchProviders.toUpperCase()}
      </Text>
      <XStack
        alignItems="center"
        gap="$2"
        paddingHorizontal="$3"
        height={44}
        borderRadius={radius.chip}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surfaceMuted}
      >
        <Icons.Search size={16} color={ui.textMuted} />
        <Input
          flex={1}
          borderWidth={0}
          backgroundColor="transparent"
          paddingHorizontal={0}
          height="$4"
          placeholder={PAYMENT_UI_COPY.searchProvidersPlaceholder}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {value.trim().length > 0 ? (
          <YStack
            cursor="pointer"
            padding="$1"
            borderRadius={999}
            hoverStyle={{ backgroundColor: ui.surface }}
            onPress={() => onChange('')}
          >
            <Icons.X size={16} color={ui.textMuted} />
          </YStack>
        ) : null}
      </XStack>
      {showCount ? (
        <Text fontSize={12} color={ui.textMuted}>
          {paymentSearchResultsCount(resultCount, totalCount)}
        </Text>
      ) : null}
    </YStack>
  )
}
