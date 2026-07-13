import { RequireShopAccess } from '~/components/auth/RequireShopAccess'
import { ShopErrorBoundary } from '~/commerce/components/ShopErrorBoundary'
import { VendorEditShopScreen } from '~/commerce/screens/vendor/VendorEditShopScreen'

export default function VendorEditShopRoute() {
  return (
    <RequireShopAccess redirectTo="/vendor/myshop/edit">
      <ShopErrorBoundary>
        <VendorEditShopScreen />
      </ShopErrorBoundary>
    </RequireShopAccess>
  )
}
