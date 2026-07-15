import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'one'

import {
  disablePushDevice,
  registerPushDevice,
} from '~/lib/notifications/push-devices'
import pushClient from '~/lib/notifications/push-client'
import {
  getOneSignalAppId,
  pathFromNotificationUrl,
} from '~/lib/notifications/push-config'
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

/**
 * Cross-platform push lifecycle:
 * web / iOS / Android → OneSignal → `user_push_devices` → dispatch-notifications.
 */
export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabase()
  const router = useRouter()
  const isConfigured = !!getOneSignalAppId()
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const syncDevice = useCallback(async () => {
    if (!isConfigured || !user?.id) {
      setPlayerId(null)
      return
    }
    try {
      await pushClient.init()
      await pushClient.login(user.id)
      const permitted = await pushClient.getPermission()
      setPermissionGranted(permitted)
      const id = await pushClient.getPlayerId()
      setPlayerId(id)
      if (permitted && id) {
        await registerPushDevice({
          userId: user.id,
          playerId: id,
          platform: pushClient.platform,
          provider: 'onesignal',
        })
      }
    } catch (error) {
      console.warn('[push] syncDevice failed', error)
    }
  }, [isConfigured, user?.id])

  useEffect(() => {
    if (!isConfigured) return
    void pushClient.init()
  }, [isConfigured])

  useEffect(() => {
    if (!user?.id) {
      void pushClient.logout()
      setPlayerId(null)
      return
    }
    void syncDevice()
  }, [user?.id, syncDevice])

  useEffect(() => {
    if (!isConfigured) return
    return pushClient.onNotificationClick((payload) => {
      const path = pathFromNotificationUrl(payload.url)
      if (path) {
        try {
          router.push(path as never)
        } catch {
          // ignore navigation failures
        }
      }
    })
  }, [isConfigured, router])

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
      const granted = await pushClient.requestPermission()
      setPermissionGranted(granted)
      if (!granted) {
        return { ok: false, error: 'Permission was denied. Enable notifications in system settings.' }
      }
      await pushClient.optIn()
      // Subscription id can arrive slightly after permission.
      let id = await pushClient.getPlayerId()
      if (!id) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        id = await pushClient.getPlayerId()
      }
      setPlayerId(id)
      if (!id) {
        return {
          ok: false,
          error: 'Could not obtain a push subscription yet. Try again in a moment.',
        }
      }
      const { error } = await registerPushDevice({
        userId: user.id,
        playerId: id,
        platform: pushClient.platform,
        provider: 'onesignal',
      })
      if (error) return { ok: false, error }
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to enable push',
      }
    } finally {
      setIsBusy(false)
    }
  }, [isConfigured, user?.id])

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
