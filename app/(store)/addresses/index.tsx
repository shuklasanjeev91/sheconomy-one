import { RequireAuth } from '~/components/auth/RequireAuth'
import { AddressesScreen } from '~/commerce/screens/AddressesScreen'

export default function AddressesRoute() {
  return (
    <RequireAuth redirectTo="/addresses">
      <AddressesScreen />
    </RequireAuth>
  )
}
