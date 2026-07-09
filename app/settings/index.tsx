import { RequireAuth } from '~/components/auth/RequireAuth'
import { SettingsScreen } from '~/community/screens/SettingsScreen'

export default function SettingsRoute() {
  return (
    <RequireAuth redirectTo="/settings">
      <SettingsScreen />
    </RequireAuth>
  )
}