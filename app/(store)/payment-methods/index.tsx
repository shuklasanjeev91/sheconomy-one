import { RequireAuth } from '~/components/auth/RequireAuth'
import { PaymentMethodsScreen } from '~/commerce/screens/PaymentMethodsScreen'

export default function PaymentMethodsRoute() {
  return (
    <RequireAuth redirectTo="/payment-methods">
      <PaymentMethodsScreen />
    </RequireAuth>
  )
}
