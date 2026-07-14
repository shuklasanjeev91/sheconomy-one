import { RequireAuth } from '~/components/auth/RequireAuth'
import { SettingsScreen } from '~/screens/SettingsScreen'

/** Single app-wide settings route (Marketplace + Community + Chat + …). */
export default function SettingsRoute() {
  return (
    <RequireAuth redirectTo="/settings">
      <SettingsScreen />
    </RequireAuth>
  )
}
