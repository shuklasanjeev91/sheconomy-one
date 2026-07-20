import { YStack } from '~/components/ui'
import type { Shop } from '~/lib/shop/shop.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { VendorReturnPolicyHubPanel } from './VendorReturnPolicyHubPanel'

type VendorReturnPolicySettingsProps = {
  ui: AppUiTokens
  shop: Shop
  isDesktop: boolean
  safeBottom: number
}

/**
 * Returns section of `/vendor/settings?section=returns`.
 * Mirrors `VendorPaymentSettings` — same shell and padding pattern.
 */
export function VendorReturnPolicySettings({
  ui,
  shop,
  isDesktop,
  safeBottom,
}: VendorReturnPolicySettingsProps) {
  return (
    <YStack flex={1} minHeight={0} width="100%" maxWidth="100%">
      <YStack
        gap="$4"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom="$5"
      >
        <VendorReturnPolicyHubPanel
          ui={ui}
          shopId={shop.id}
          shopName={shop.shop_name}
          isDesktop={isDesktop}
          safeBottom={safeBottom}
        />
      </YStack>
    </YStack>
  )
}
