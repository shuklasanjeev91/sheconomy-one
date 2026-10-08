import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState, Linking, type AppStateStatus } from 'react-native'

import { MandatoryStoreUpdateScreen } from '~/components/system/MandatoryStoreUpdateScreen'
import { PendingMeetingJoinResume } from '~/components/system/PendingMeetingJoinResume.native'
import { StoreUpdateAvailableDialog } from '~/components/system/StoreUpdateAvailableDialog'
import { savePendingMeetingJoinFromUrl } from '~/co-work/lib/pending-meeting-join'
import {
  availableStoreVersion,
  dismissStoreUpdate,
  getNativeAppVersion,
  openAppStore,
  readCachedRemoteConfig,
  readStoreUpdateDismissal,
  refreshRemoteConfig,
  requiredStoreVersion,
  shouldAutoAttemptMandatoryUpdate,
  shouldPromptStoreUpdate,
  type RemoteUpdateConfig,
} from '~/lib/updates'
import { FORCE_UPDATE_AUTO_RETRY_MS } from '~/lib/updates/constants'

const isDev = typeof __DEV__ !== 'undefined' && __DEV__

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
  const [policyChecked, setPolicyChecked] = useState(isDev)
  const lastForcedUpdateAttemptAtRef = useRef<number | null>(null)
  const requiredVersionRef = useRef<string | null>(null)
  const latestLaunchUrlRef = useRef<string | null>(null)

  const attemptMandatoryUpdate = useCallback(async () => {
    if (!requiredVersion) return
    const now = Date.now()
    if (
      !shouldAutoAttemptMandatoryUpdate(
        lastForcedUpdateAttemptAtRef.current,
        now,
        FORCE_UPDATE_AUTO_RETRY_MS,
      )
    ) {
      return
    }
    lastForcedUpdateAttemptAtRef.current = now
    await openAppStore({ fallbackOnCancel: true })
  }, [requiredVersion])

  useEffect(() => {
    requiredVersionRef.current = requiredVersion
    if (requiredVersion && latestLaunchUrlRef.current) {
      void savePendingMeetingJoinFromUrl(latestLaunchUrlRef.current)
    }
  }, [requiredVersion])

  useEffect(() => {
    if (isDev) return

    let disposed = false

    const captureMeetingLink = (url: string | null) => {
      if (!url || disposed) return
      latestLaunchUrlRef.current = url
      if (requiredVersionRef.current) void savePendingMeetingJoinFromUrl(url)
    }

    void Linking.getInitialURL().then(captureMeetingLink)
    const subscription = Linking.addEventListener('url', ({ url }) => captureMeetingLink(url))

    return () => {
      disposed = true
      subscription.remove()
    }
  }, [])

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
      if (cancelled) return
      fetchedFresh = true
      if (fresh) await applyPolicy(fresh, false)
      if (!cancelled) setPolicyChecked(true)
    }
    void refresh()

    let lastState: AppStateStatus = AppState.currentState
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refresh()
        if (lastState.match(/inactive|background/)) void attemptMandatoryUpdate()
      }
      lastState = next
    })
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [attemptMandatoryUpdate, installed])

  useEffect(() => {
    void attemptMandatoryUpdate()
  }, [attemptMandatoryUpdate])

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
      {policyChecked ? <PendingMeetingJoinResume /> : null}
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
