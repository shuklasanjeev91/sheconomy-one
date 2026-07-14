import { useCallback, useEffect, useState } from 'react'

import { MaintenanceScreen } from '~/components/system/MaintenanceScreen'
import { fetchRemoteUpdateConfig } from '~/lib/updates'
import { logUpdate } from '~/lib/updates/logging'

/**
 * Web: expo-updates is not used. Relies on normal web deploy / CDN cache
 * invalidation. Still honors remote maintenance mode when configured.
 */
export function AutomaticUpdateManager() {
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null)

  const checkRemote = useCallback(async () => {
    try {
      const config = await fetchRemoteUpdateConfig()
      if (config?.maintenanceMode) {
        setMaintenanceMessage(
          config.maintenanceMessage?.trim() ||
            'We are performing scheduled maintenance. Please try again shortly.',
        )
        return
      }
      setMaintenanceMessage(null)
    } catch (error) {
      logUpdate('warn', 'Web update config check failed', error)
    }
  }, [])

  useEffect(() => {
    void checkRemote()
  }, [checkRemote])

  if (!maintenanceMessage) return null

  return (
    <MaintenanceScreen
      message={maintenanceMessage}
      onRetry={() => {
        setMaintenanceMessage(null)
        void checkRemote()
      }}
    />
  )
}

export default AutomaticUpdateManager
