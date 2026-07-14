import { RequireShopAccess } from '~/components/auth/RequireShopAccess'
import { ShopErrorBoundary } from '~/commerce/components/ShopErrorBoundary'
import { VendorMyShopScreen } from '~/commerce/screens/vendor/VendorMyShopScreen'

export default function VendorMyShopRoute() {
  return (
    <RequireShopAccess redirectTo="/vendor/myshop">
      <ShopErrorBoundary>
        <VendorMyShopScreen />
      </ShopErrorBoundary>
    </RequireShopAccess>
  )
}
