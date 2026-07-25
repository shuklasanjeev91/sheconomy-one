import { Button, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { PAYMENT_UI_COPY } from '~/lib/payment/payment-ui.copy'
import {
  getProviderActionLabel,
  getProviderBadgeLabel,
  isProviderConnected,
} from '~/lib/payment/payment.utils'
import type { ConnectedProviderSummary, PaymentProviderConfig, ShopPaymentAccount } from '~/lib/payment/payment.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { PaymentProviderIcon } from '~/commerce/components/vendor/payment/PaymentProviderIcon'

type PaymentProviderCardProps = {
  ui: AppUiTokens
  provider: PaymentProviderConfig
  accounts: ShopPaymentAccount[]
  connectedProviders: ConnectedProviderSummary[]
  onPress: (provider: PaymentProviderConfig) => void
}

export function PaymentProviderCard({
  ui,
  provider,
  accounts,
  connectedProviders,
  onPress,
}: PaymentProviderCardProps) {
  const connected = isProviderConnected(provider.id, accounts, connectedProviders)
  const badge = getProviderBadgeLabel(provider)
  const actionLabel = getProviderActionLabel(provider, connected)

  return (
    <YStack
      width="100%"
      alignSelf="stretch"
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={connected ? ui.brand : ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
        <PaymentProviderIcon provider={provider} size={44} />
        {badge ? (
          <YStack
            paddingHorizontal="$2.5"
            paddingVertical={4}
            borderRadius={999}
            backgroundColor={ui.roseSurface}
          >
            <Text fontSize={10} fontWeight="700" color={ui.brand} letterSpacing={0.4}>
              {badge}
            </Text>
          </YStack>
        ) : connected ? (
          <YStack
            paddingHorizontal="$2.5"
            paddingVertical={4}
            borderRadius={999}
            backgroundColor="#DCFCE7"
          >
            <Text fontSize={10} fontWeight="700" color="#166534">
              {PAYMENT_UI_COPY.providerConnected}
            </Text>
          </YStack>
        ) : null}
      </XStack>

      <YStack gap="$1.5" width="100%">
        <Text fontSize={16} fontWeight="800" color={ui.text} letterSpacing={-0.2}>
          {provider.name}
        </Text>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={19} numberOfLines={3}>
          {provider.description}
        </Text>
      </YStack>

      <Button
        tone="outline"
        size="$3"
        borderRadius={999}
        borderColor={ui.brand}
        color={ui.brand}
        width="100%"
        onPress={() => onPress(provider)}
      >
        {actionLabel}
      </Button>
    </YStack>
  )
}
