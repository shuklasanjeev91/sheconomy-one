import { RequireAuth } from '~/components/auth/RequireAuth'
import { PlatformPayuSuccessScreen } from '~/commerce/screens/PlatformPayuResultScreens'

export default function PlatformPayuSuccessRoute() {
  return (
    <RequireAuth redirectTo="/payment/success">
      <PlatformPayuSuccessScreen />
    </RequireAuth>
  )
}
