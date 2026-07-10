import { RequireShopAccess } from '~/components/auth/RequireShopAccess'
import { SellerDashboardScreen } from '~/commerce/screens/SellerDashboardScreen'

export default function ManageShopRoute() {
  return (
    <RequireShopAccess redirectTo="/my-shops">
      <SellerDashboardScreen />
    </RequireShopAccess>
  )
}
