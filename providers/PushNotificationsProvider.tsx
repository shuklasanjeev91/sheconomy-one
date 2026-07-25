import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Platform } from 'react-native'

import {
  disablePushDevice,
  registerPushDevice,
} from '~/lib/notifications/push-devices'
import pushClient from '~/lib/notifications/push-client'
import {
  markPushAutoPromptAttempted,
  shouldAutoPromptPush,
} from '~/lib/notifications/push-auto-prompt'
import {
  getOneSignalAppId,
  pathFromNotificationUrl,
} from '~/lib/notifications/push-config'
import { navigateApp } from '~/lib/platform/navigate'
import { useSupabase } from '~/providers/SupabaseProvider'

type PushNotificationsContextValue = {
  /** Whether OneSignal App ID is configured. */
  isConfigured: boolean
  /** Current OS permission for this device. */
  permissionGranted: boolean
  /** True while requesting permission or syncing device. */
  isBusy: boolean
  /** Last registered OneSignal player/subscription id. */
  playerId: string | null
  /** Request OS permission and register this device. */
  enablePush: () => Promise<{ ok: boolean; error?: string }>
  /** Opt out + disable this device row. */
  disablePush: () => Promise<{ ok: boolean; error?: string }>
  /** Re-sync player id for the signed-in user. */
  syncDevice: () => Promise<void>
}

const PushNotificationsContext = createContext<PushNotificationsContextValue | null>(null)

async function waitForPlayerId(attempts = 6, delayMs = 700): Promise<string | null> {
  let id: string | null = null
  for (let attempt = 0; attempt < attempts && !id; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    id = await pushClient.getPlayerId()
  }
  return id
}

/**
 * Cross-platform push lifecycle:
 * web / iOS / Android → OneSignal → `user_push_devices` → dispatch-notifications.
 *
 * On sign-in, auto-requests OS permission once (like most apps) when the OS
 * still allows prompting, then registers the subscription.
 */
export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabase()
  const isConfigured = !!getOneSignalAppId()
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  // Avoid running OneSignal / push side-effects during SSR (dual-renderer warning).
  const [clientReady, setClientReady] = useState(Platform.OS !== 'web')
  const autoSubscribeStartedRef = useRef(false)
  const pushSessionActiveRef = useRef(false)

  useEffect(() => {
    setClientReady(true)
  }, [])

  const registerIfPossible = useCallback(
    async (userId: string, permitted: boolean) => {
      if (!permitted) {
        setPlayerId(null)
        return null
      }
      await pushClient.optIn()
      const id = await waitForPlayerId()
      setPlayerId(id)
      if (id) {
        await registerPushDevice({
          userId,
          playerId: id,
          platform: pushClient.platform,
          provider: 'onesignal',
        })
      }
      return id
    },
    [],
  )

  const syncDevice = useCallback(async () => {
    if (!isConfigured || !user?.id) {
      setPlayerId(null)
      return
    }
    try {
      await pushClient.init()
      await pushClient.login(user.id)
      pushSessionActiveRef.current = true
      const permitted = await pushClient.getPermission()
      setPermissionGranted(permitted)
      await registerIfPossible(user.id, permitted)
    } catch (error) {
      console.warn('[push] syncDevice failed', error)
    }
  }, [isConfigured, registerIfPossible, user?.id])

  useEffect(() => {
    if (!clientReady || !isConfigured) return
    const timer = setTimeout(() => {
      void pushClient.init()
    }, 1_500)
    return () => clearTimeout(timer)
  }, [clientReady, isConfigured])

  useEffect(() => {
    if (!clientReady) return
    if (!user?.id) {
      autoSubscribeStartedRef.current = false
      setPlayerId(null)
      setPermissionGranted(false)
      // Only logout after a prior login/init — never before OneSignal.initialize.
      if (pushSessionActiveRef.current) {
        pushSessionActiveRef.current = false
        void pushClient.logout()
      }
      return
    }
    void syncDevice()
  }, [clientReady, user?.id, syncDevice])

  useEffect(() => {
    if (!clientReady || !isConfigured) return
    return pushClient.onNotificationClick((payload) => {
      const path = pathFromNotificationUrl(payload.url)
      if (path) {
        try {
          navigateApp(path)
        } catch {
          // ignore navigation failures
        }
      }
    })
  }, [clientReady, isConfigured])

  const enablePush = useCallback(async () => {
    if (!isConfigured) {
      return { ok: false, error: 'Push is not configured (missing OneSignal App ID).' }
    }
    if (!user?.id) {
      return { ok: false, error: 'Sign in to enable push notifications.' }
    }
    setIsBusy(true)
    try {
      await pushClient.init()
      await pushClient.login(user.id)
      pushSessionActiveRef.current = true
      const granted = await pushClient.requestPermission()
      setPermissionGranted(granted)
      if (!granted) {
        return { ok: false, error: 'Permission was denied. Enable notifications in system settings.' }
      }
      const id = await registerIfPossible(user.id, true)
      if (!id) {
        return {
          ok: false,
          error:
            'Could not obtain a push subscription yet. Check notification permission, then try again.',
        }
      }
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to enable push',
      }
    } finally {
      setIsBusy(false)
    }
  }, [isConfigured, registerIfPossible, user?.id])

  // Auto-subscribe after sign-in when the OS will still show a permission prompt.
  useEffect(() => {
    if (!clientReady || !isConfigured || !user?.id || autoSubscribeStartedRef.current) return

    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled || autoSubscribeStartedRef.current) return

        try {
          await pushClient.init()
          await pushClient.login(user.id)
          pushSessionActiveRef.current = true

          const permitted = await pushClient.getPermission()
          if (cancelled) return

          if (permitted) {
            setPermissionGranted(true)
            await registerIfPossible(user.id, true)
            await markPushAutoPromptAttempted()
            return
          }

          const canRequest = await pushClient.canRequestPermission()
          if (cancelled || !canRequest) return

          const shouldPrompt = await shouldAutoPromptPush()
          if (cancelled || !shouldPrompt) return

          autoSubscribeStartedRef.current = true
          await markPushAutoPromptAttempted()
          await enablePush()
        } catch (error) {
          console.warn('[push] auto-subscribe failed', error)
        }
      })()
    }, 1_200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [clientReady, enablePush, isConfigured, registerIfPossible, user?.id])

  const disablePush = useCallback(async () => {
    if (!user?.id) return { ok: false, error: 'Not signed in' }
    setIsBusy(true)
    try {
      await pushClient.optOut()
      const id = playerId ?? (await pushClient.getPlayerId())
      if (id) {
        await disablePushDevice(user.id, id)
      }
      setPermissionGranted(false)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to disable push',
      }
    } finally {
      setIsBusy(false)
    }
  }, [playerId, user?.id])

  const value = useMemo<PushNotificationsContextValue>(
    () => ({
      isConfigured,
      permissionGranted,
      isBusy,
      playerId,
      enablePush,
      disablePush,
      syncDevice,
    }),
    [
      disablePush,
      enablePush,
      isBusy,
      isConfigured,
      permissionGranted,
      playerId,
      syncDevice,
    ],
  )

  return (
    <PushNotificationsContext.Provider value={value}>
      {children}
    </PushNotificationsContext.Provider>
  )
}

export function usePushNotifications() {
  const ctx = useContext(PushNotificationsContext)
  if (!ctx) {
    throw new Error('usePushNotifications must be used within PushNotificationsProvider')
  }
  return ctx
}
