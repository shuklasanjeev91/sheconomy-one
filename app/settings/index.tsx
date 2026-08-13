import { useEffect } from 'react'

import { SettingsHubList } from '~/components/settings/SettingsShell'
import { useAppLayout } from '~/hooks/useAppLayout'
import { replaceApp } from '~/lib/platform/navigate'
import { appRoutes } from '~/lib/routes'

/** Narrow: category list. Rail layouts: redirect into account panel (sidebar stays visible). */
export default function SettingsIndexRoute() {
  const { hasSideRails, isMediaHydrated } = useAppLayout()

  useEffect(() => {
    if (!isMediaHydrated) return
    if (hasSideRails) {
      replaceApp(appRoutes.settingsSection('account'))
    }
  }, [hasSideRails, isMediaHydrated])

  if (!isMediaHydrated || hasSideRails) {
    return null
  }

  return <SettingsHubList />
}
