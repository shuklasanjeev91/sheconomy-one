import { useEffect } from 'react'

import { SettingsHubList } from '~/components/settings/SettingsShell'
import { useAppLayout } from '~/hooks/useAppLayout'
import { replaceApp } from '~/lib/platform/navigate'
import { appRoutes } from '~/lib/routes'

/** Mobile: category list. Desktop: redirect into account panel (sidebar stays visible). */
export default function SettingsIndexRoute() {
  const { isDesktop, isMediaHydrated } = useAppLayout()

  useEffect(() => {
    if (!isMediaHydrated) return
    if (isDesktop) {
      replaceApp(appRoutes.settingsSection('account'))
    }
  }, [isDesktop, isMediaHydrated])

  if (!isMediaHydrated || isDesktop) {
    return null
  }

  return <SettingsHubList />
}
