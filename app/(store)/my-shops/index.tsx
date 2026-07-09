import { RequireShopAccess } from '~/components/auth/RequireShopAccess'
import { MyShopsScreen } from '~/commerce/screens/MyShopsScreen'

export default function MyShopsRoute() {
  return (
    <RequireShopAccess redirectTo="/my-shops">
      <MyShopsScreen />
    </RequireShopAccess>
  )
}