import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, InteractionManager, type AppStateStatus } from 'react-native'
import * as Updates from 'expo-updates'

import { MaintenanceScreen } from '~/components/system/MaintenanceScreen'
import { UpdatePromptDialog } from '~/components/system/UpdatePromptDialog'
import { createNativeUpdateServiceDeps } from '~/lib/updates/create-native-deps'
import {
  applyDownloadedUpdate,
  dismissOptionalUpdate,
  markUpdateApplied,
  readUpdateMetadata,
  runUpdateCheck,
  shouldPromptForDownloadedUpdate,
  type UpdateStatus,
} from '~/lib/updates'
import { UPDATE_CHECK_STARTUP_DELAY_MS } from '~/lib/updates/constants'

/**
 * Native (iOS / Android) OTA manager — checks on launch and resume,
 * downloads silently, then reloads immediately so production pushes go live
 * without a manual "Restart" tap. Keeps running while ForceUpdateGate blocks
 * the app, so fixes still reach installs below the minimum store version.
 */
export function AutomaticUpdateManager() {
  const depsRef = useRef(createNativeUpdateServiceDeps())
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [promptOpen, setPromptOpen] = useState(false)
  const [critical, setCritical] = useState(false)
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null)
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const check = useCallback(async (force = false) => {
    const deps = depsRef.current
    if (deps.isDev || !Updates.isEnabled) {
      setStatus('idle')
      return
    }

    setStatus('checking')
    const result = await runUpdateCheck(deps, { force })

    switch (result.kind) {
      case 'skipped':
        setStatus('idle')
        break
      case 'upToDate':
        setStatus('upToDate')
        break
      case 'maintenance':
        setStatus('idle')
        setMaintenanceMessage(result.message)
        break
      case 'failed':
        setStatus('failed')
        break
      case 'downloaded': {
        setStatus('downloaded')
        setPendingUpdateId(result.updateId)
        setCritical(result.critical)
        // Apply immediately so store users get JS/asset OTA without waiting
        // for a manual "Restart" tap. Critical and optional both reload.
        setBusy(true)
        setStatus('restarting')
        const outcome = await applyDownloadedUpdate(deps, result.updateId)
        if (outcome === 'failed') {
          setBusy(false)
          setStatus('failed')
          const metadata = await readUpdateMetadata()
          if (result.critical || shouldPromptForDownloadedUpdate(result, metadata)) {
            setPromptOpen(true)
          }
        }
        break
      }
      case 'available':
        setStatus('available')
        break
      default:
        setStatus('idle')
    }
  }, [])

  useEffect(() => {
    const deps = depsRef.current
    if (deps.isDev || !Updates.isEnabled) return

    // Local Release installs historically omitted the EAS channel; without
    // expo-channel-name, checkForUpdateAsync never sees production OTAs.
    if (!Updates.channel) {
      console.warn(
        '[updates] No EAS channel on this binary — ensure EXUpdatesRequestHeaders / UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY set expo-channel-name=production',
      )
    }

    void markUpdateApplied(deps, Updates.updateId ?? null)

    // Defer first check so home/network aren't competing with OTA download on cold start.
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const interaction = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        // Force the first check so a cooldown from a previous session cannot
        // leave App Store iOS on the embedded bundle after a production OTA.
        if (!cancelled) void check(true)
      }, UPDATE_CHECK_STARTUP_DELAY_MS)
    })

    let lastState: AppStateStatus = AppState.currentState
    const subscription = AppState.addEventListener('change', (next) => {
      if (lastState.match(/inactive|background/) && next === 'active') {
        void check(false)
      }
      lastState = next
    })

    return () => {
      cancelled = true
      interaction.cancel?.()
      if (timer) clearTimeout(timer)
      subscription.remove()
    }
  }, [check])

  async function handleRestart() {
    const deps = depsRef.current
    setBusy(true)
    setStatus('restarting')
    const outcome = await applyDownloadedUpdate(deps, pendingUpdateId)
    if (outcome === 'failed') {
      setBusy(false)
      setStatus('failed')
      setPromptOpen(false)
    }
  }

  async function handleLater() {
    const deps = depsRef.current
    await dismissOptionalUpdate(deps, pendingUpdateId)
    setPromptOpen(false)
    setStatus('downloaded')
  }

  if (maintenanceMessage) {
    return (
      <MaintenanceScreen
        message={maintenanceMessage}
        onRetry={() => {
          setMaintenanceMessage(null)
          void check(true)
        }}
      />
    )
  }

  return (
    <UpdatePromptDialog
      open={promptOpen}
      critical={critical}
      busy={busy || status === 'restarting'}
      onRestart={() => void handleRestart()}
      onLater={critical ? undefined : () => void handleLater()}
    />
  )
}

export default AutomaticUpdateManager
