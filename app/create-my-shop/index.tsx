import { RouteGuard } from '~/components/auth/RouteGuard'
import { ShopErrorBoundary } from '~/commerce/components/ShopErrorBoundary'
import { CreateShopScreen } from '~/commerce/screens/CreateShopScreen'

export default function CreateMyShopRoute() {
  return (
    // Any signed-in member can open a shop, but seller tools need Human verification —
    // guests are sent to sign in and unverified users to Human verification.
    <RouteGuard allowedRoles={[]} requireGenderVerification signInReturnTo="/create-my-shop">
      <ShopErrorBoundary scope="CreateShop">
        <CreateShopScreen />
      </ShopErrorBoundary>
    </RouteGuard>
  )
}
