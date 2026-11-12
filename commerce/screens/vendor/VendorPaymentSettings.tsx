import { Text, YStack } from '~/components/ui'
import type { Shop } from '~/lib/shop/shop.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { VendorPaymentMethodsPanel } from '~/commerce/screens/vendor/VendorPaymentMethodsPanel'

type VendorPaymentSettingsProps = {
  ui: AppUiTokens
  shop: Shop
  isDesktop: boolean
  safeBottom: number
}

/**
 * Payouts section of `/vendor/settings?section=payments`.
 * KYC upload lives under Verification; this page shows settlement status.
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
            Payouts
          </Text>
          <Text fontSize={14} color={ui.textSecondary} maxWidth={620}>
            Settlement status after Verification. Complete KYC under Verification if payouts are not
            active yet.
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
