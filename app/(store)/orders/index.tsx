import { RequireAuth } from '~/components/auth/RequireAuth'
import { OrderHistoryScreen } from '~/commerce/screens/OrderHistoryScreen'

export default function OrdersRoute() {
  return (
    <RequireAuth redirectTo="/orders">
      <OrderHistoryScreen />
    </RequireAuth>
  )
}
