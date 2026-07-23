import { RequireAuth } from '~/components/auth/RequireAuth'
import { OrderSuccessScreen } from '~/commerce/screens/OrderSuccessScreen'

export default function OrderSuccessRoute() {
  return (
    <RequireAuth redirectTo="/orders/success">
      <OrderSuccessScreen />
    </RequireAuth>
  )
}
