import { RequireAuth } from '~/components/auth/RequireAuth'
import { NotificationsScreen } from '~/community/screens/NotificationsScreen'

export default function NotificationsRoute() {
  return (
    <RequireAuth redirectTo="/notifications">
      <NotificationsScreen />
    </RequireAuth>
  )
}