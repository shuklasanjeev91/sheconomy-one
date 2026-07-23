import { ShopErrorBoundary } from '~/commerce/components/ShopErrorBoundary'
import { VendorEditShopScreen } from '~/commerce/screens/vendor/VendorEditShopScreen'

/** Auth/role gating lives in `app/vendor/_layout.tsx` (`RequireVendorRole`). */
export default function VendorEditShopRoute() {
  return (
    <ShopErrorBoundary>
      <VendorEditShopScreen />
    </ShopErrorBoundary>
  )
}
