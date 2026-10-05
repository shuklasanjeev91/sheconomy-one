import { useEffect, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'

import { MandatoryStoreUpdateScreen } from '~/components/system/MandatoryStoreUpdateScreen'
import { StoreUpdateAvailableDialog } from '~/components/system/StoreUpdateAvailableDialog'
import {
  availableStoreVersion,
  dismissStoreUpdate,
  getNativeAppVersion,
  openAppStore,
  readCachedRemoteConfig,
  readStoreUpdateDismissal,
  refreshRemoteConfig,
  requiredStoreVersion,
  shouldPromptStoreUpdate,
  type RemoteUpdateConfig,
} from '~/lib/updates'
import { startPlayImmediateUpdate } from '~/lib/updates/play-in-app-update'

const isDev = typeof __DEV__ !== 'undefined' && __DEV__

// Once per process: re-launching Play's flow on every resume would trap the
// user in a loop after they back out of it.
let autoStartedPlayUpdate = false

/**
 * Store-version gate. Below `minimumSupportedVersion` the app is replaced by
 * the update screen (nothing behind it can open over it); below
 * `latestVersion` a dismissible prompt is shown. Decided from the cached
 * policy first so it also applies offline, then refreshed on launch/resume.
 */
export function ForceUpdateGate({ children }: { children: ReactNode }) {
  const installed = getNativeAppVersion()
  const [requiredVersion, setRequiredVersion] = useState<string | null>(null)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)

  useEffect(() => {
    if (isDev) return
    let cancelled = false
    let fetchedFresh = false

    const applyPolicy = async (config: RemoteUpdateConfig | null, fromCache: boolean) => {
      const stale = () => cancelled || (fromCache && fetchedFresh)
      if (stale()) return
      setRequiredVersion(requiredStoreVersion(config, installed))
      const latest = availableStoreVersion(config, installed)
      const dismissal = latest ? await readStoreUpdateDismissal() : null
      if (stale()) return
      setLatestVersion(
        latest && shouldPromptStoreUpdate(latest, dismissal, Date.now()) ? latest : null,
      )
    }

    void readCachedRemoteConfig().then((cached) => applyPolicy(cached, true))

    const refresh = async () => {
      const fresh = await refreshRemoteConfig()
      if (cancelled || !fresh) return
      fetchedFresh = true
      await applyPolicy(fresh, false)
    }
    void refresh()

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh()
    })
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [installed])

  useEffect(() => {
    if (!requiredVersion || autoStartedPlayUpdate) return
    autoStartedPlayUpdate = true
    void startPlayImmediateUpdate()
  }, [requiredVersion])

  if (requiredVersion) {
    return (
      <MandatoryStoreUpdateScreen
        minimumSupportedVersion={requiredVersion}
        currentVersion={installed}
      />
    )
  }

  async function handleLater() {
    if (latestVersion) await dismissStoreUpdate(latestVersion, Date.now())
    setLatestVersion(null)
  }

  return (
    <>
      {children}
      {latestVersion ? (
        <StoreUpdateAvailableDialog
          open
          latestVersion={latestVersion}
          currentVersion={installed}
          onUpdate={() => void openAppStore()}
          onLater={() => void handleLater()}
        />
      ) : null}
    </>
  )
}

export default ForceUpdateGate
