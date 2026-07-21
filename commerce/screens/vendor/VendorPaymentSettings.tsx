import { Text, YStack } from '~/components/ui'
import { PAYMENT_UI_COPY } from '~/lib/payment/payment-ui.copy'
import type { Shop } from '~/lib/shop/shop.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { VendorPaymentMethodsPanel } from './VendorPaymentMethodsPanel'

type VendorPaymentSettingsProps = {
  ui: AppUiTokens
  shop: Shop
  isDesktop: boolean
  safeBottom: number
}

/**
 * Payment Methods section of `/vendor/settings?section=payments`.
 * Mirrors `VendorConnectSettings` — same shell, padding, and title pattern.
 */
export function VendorPaymentSettings({
  ui,
  shop,
  isDesktop,
  safeBottom,
}: VendorPaymentSettingsProps) {
  return (
    <YStack flex={1} minHeight={0} width="100%" maxWidth="100%">
      <YStack
        gap="$4"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom="$5"
      >
        <YStack gap="$1">
          <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
            {PAYMENT_UI_COPY.pageTitle}
          </Text>
          <Text fontSize={14} color={ui.textSecondary} maxWidth={620}>
            {PAYMENT_UI_COPY.pageSubtitle}
          </Text>
        </YStack>

        <VendorPaymentMethodsPanel
          ui={ui}
          shopId={shop.id}
          isDesktop={isDesktop}
          safeBottom={safeBottom}
        />
      </YStack>
    </YStack>
  )
}
