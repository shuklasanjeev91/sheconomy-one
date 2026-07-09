import { RequireAuth } from '~/components/auth/RequireAuth'
import { ProfileScreen } from '~/community/screens/ProfileScreen'

export default function ProfileRoute() {
  return (
    <RequireAuth redirectTo="/profile">
      <ProfileScreen />
    </RequireAuth>
  )
}