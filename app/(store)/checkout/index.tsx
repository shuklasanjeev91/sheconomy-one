import { RequireAuth } from '~/components/auth/RequireAuth'
import { CheckoutScreen } from '~/commerce/screens/CheckoutScreen'

export default function CheckoutRoute() {
  return (
    <RequireAuth redirectTo="/checkout">
      <CheckoutScreen />
    </RequireAuth>
  )
}