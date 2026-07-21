import { YStack } from '~/components/ui'
import type { Shop } from '~/lib/shop/shop.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { VendorShippingPolicyHubPanel } from './VendorShippingPolicyHubPanel'

type VendorShippingPolicySettingsProps = {
  ui: AppUiTokens
  shop: Shop
  isDesktop: boolean
  safeBottom: number
}

/**
 * Shipping section of `/vendor/settings?section=shipping`.
 * Shop-level delivery profiles (legacy delivery profile form).
 */
export function VendorShippingPolicySettings({
  ui,
  shop,
  isDesktop,
  safeBottom,
}: VendorShippingPolicySettingsProps) {
  return (
    <YStack flex={1} minHeight={0} width="100%" maxWidth="100%">
      <YStack
        gap="$4"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom="$5"
      >
        <VendorShippingPolicyHubPanel
          ui={ui}
          shopId={shop.id}
          shopAddressId={shop.shop_address_id}
          shopCurrency={shop.shop_currency}
          isDesktop={isDesktop}
          safeBottom={safeBottom}
        />
      </YStack>
    </YStack>
  )
}
