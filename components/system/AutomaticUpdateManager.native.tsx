import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import * as Updates from 'expo-updates'

import { MaintenanceScreen } from '~/components/system/MaintenanceScreen'
import { MandatoryStoreUpdateScreen } from '~/components/system/MandatoryStoreUpdateScreen'
import { UpdatePromptDialog } from '~/components/system/UpdatePromptDialog'
import { createNativeUpdateServiceDeps } from '~/lib/updates/create-native-deps'
import {
  applyDownloadedUpdate,
  dismissOptionalUpdate,
  getNativeAppVersion,
  markUpdateApplied,
  readUpdateMetadata,
  runUpdateCheck,
  shouldPromptForDownloadedUpdate,
  type UpdateStatus,
} from '~/lib/updates'

/**
 * Native (iOS / Android) OTA manager — checks on launch and resume,
 * downloads silently, prompts for restart (or forces critical updates).
 */
export function AutomaticUpdateManager() {
  const depsRef = useRef(createNativeUpdateServiceDeps())
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [promptOpen, setPromptOpen] = useState(false)
  const [critical, setCritical] = useState(false)
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null)
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null)
  const [storeMinimum, setStoreMinimum] = useState<string | null>(null)
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
      case 'storeRequired':
        setStatus('idle')
        setStoreMinimum(result.minimumSupportedVersion)
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

    void markUpdateApplied(deps, Updates.updateId ?? null)
    void check(false)

    let lastState: AppStateStatus = AppState.currentState
    const subscription = AppState.addEventListener('change', (next) => {
      if (lastState.match(/inactive|background/) && next === 'active') {
        void check(false)
      }
      lastState = next
    })

    return () => {
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

  if (storeMinimum) {
    return (
      <MandatoryStoreUpdateScreen
        minimumSupportedVersion={storeMinimum}
        currentVersion={getNativeAppVersion()}
      />
    )
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
