import { Slot } from 'one'

import { RequireAuth } from '~/components/auth/RequireAuth'
import { SettingsShell } from '~/components/settings/SettingsShell'
import { appRoutes } from '~/lib/routes'

export default function SettingsLayout() {
  return (
    <RequireAuth redirectTo={String(appRoutes.settings)}>
      <SettingsShell>
        <Slot />
      </SettingsShell>
    </RequireAuth>
  )
}
