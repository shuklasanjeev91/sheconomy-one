import { RequireAuth } from '~/components/auth/RequireAuth'
import { PlatformPayuFailureScreen } from '~/commerce/screens/PlatformPayuResultScreens'

export default function PlatformPayuFailureRoute() {
  return (
    <RequireAuth redirectTo="/payment/failure">
      <PlatformPayuFailureScreen />
    </RequireAuth>
  )
}
