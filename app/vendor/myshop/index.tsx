import { ShopErrorBoundary } from '~/commerce/components/ShopErrorBoundary'
import { VendorMyShopScreen } from '~/commerce/screens/vendor/VendorMyShopScreen'

/** Auth/role gating lives in `app/vendor/_layout.tsx` (`RequireVendorRole`). */
export default function VendorMyShopRoute() {
  return (
    <ShopErrorBoundary>
      <VendorMyShopScreen />
    </ShopErrorBoundary>
  )
}
