import { RequireShopAccess } from '~/components/auth/RequireShopAccess'
import { ShopErrorBoundary } from '~/commerce/components/ShopErrorBoundary'
import { VendorSettingsScreen } from '~/commerce/screens/vendor/VendorSettingsScreen'

export default function VendorSettingsRoute() {
  return (
    <RequireShopAccess redirectTo="/vendor/settings">
      <ShopErrorBoundary>
        <VendorSettingsScreen />
      </ShopErrorBoundary>
    </RequireShopAccess>
  )
}
