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
  markPushPermissionDecided,
  shouldAutoPromptPush,
} from '~/lib/notifications/push-auto-prompt'
import {
  fetchOneSignalConfig,
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
  /** In-app “Allow notifications?” dialog visibility. */
  subscribePromptVisible: boolean
  /** Hide the in-app subscribe dialog. */
  dismissSubscribePrompt: () => void
  /** Request OS permission and register this device. */
  enablePush: () => Promise<{ ok: boolean; error?: string }>
  /** Opt out + disable this device row. */
  disablePush: () => Promise<{ ok: boolean; error?: string }>
  /** Re-sync player id for the signed-in user. */
  syncDevice: () => Promise<void>
}

const PushNotificationsContext = createContext<PushNotificationsContextValue | null>(null)

async function waitForPlayerId(attempts = 10, delayMs = 600): Promise<string | null> {
  let id: string | null = null
  for (let attempt = 0; attempt < attempts && !id; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    id = await pushClient.getPlayerId()
  }
  return id
}

async function rememberDecisionIfSettled() {
  // Only persist “don’t auto-prompt again” once OS is no longer in "default".
  const stillPromptable = await pushClient.canRequestPermission()
  if (!stillPromptable) {
    await markPushPermissionDecided()
  }
}

/**
 * Cross-platform push lifecycle:
 * web / iOS / Android → OneSignal → `user_push_devices` → dispatch-notifications.
 *
 * On sign-in: bind user, register if already allowed, otherwise show the OS
 * permission prompt once until the user/OS settles the choice.
 */
export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabase()
  const [isConfigured, setIsConfigured] = useState(() => !!getOneSignalAppId())
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [clientReady, setClientReady] = useState(Platform.OS !== 'web')
  const [configReady, setConfigReady] = useState(() => !!getOneSignalAppId())
  const [subscribePromptVisible, setSubscribePromptVisible] = useState(false)
  const handledUserRef = useRef<string | null>(null)
  const pushSessionActiveRef = useRef(false)

  const dismissSubscribePrompt = useCallback(() => {
    setSubscribePromptVisible(false)
  }, [])

  useEffect(() => {
    setClientReady(true)
  }, [])

  // Load App ID from Supabase edge secrets so web + Release native match dispatch.
  useEffect(() => {
    if (!clientReady) return
    let cancelled = false
    void (async () => {
      try {
        const config = await fetchOneSignalConfig()
        if (cancelled) return
        setIsConfigured(!!config.appId)
      } catch (error) {
        console.warn('[push] config resolve failed', error)
        if (!cancelled) setIsConfigured(!!getOneSignalAppId())
      } finally {
        if (!cancelled) setConfigReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientReady])

  const registerIfPossible = useCallback(async (userId: string, permitted: boolean) => {
    if (!permitted) {
      setPlayerId(null)
      return null
    }
    await pushClient.optIn()
    // Re-bind external_id after subscribe so OneSignal links the web/iOS subscription.
    try {
      await pushClient.login(userId)
    } catch {
      // ignore
    }
    let id = await waitForPlayerId(pushClient.platform === 'web' ? 16 : 10, 700)
    // Web often has Notification.permission=granted from an earlier visit but no
    // OneSignal subscription yet — force a repair pass once.
    if (!id && pushClient.platform === 'web') {
      console.info('[push] web permission granted but no subscription id — repairing')
      const repaired = await pushClient.requestPermission()
      if (repaired) {
        await pushClient.login(userId)
        id = await waitForPlayerId(16, 700)
      }
    }
    setPlayerId(id)
    if (id) {
      const { error } = await registerPushDevice({
        userId,
        playerId: id,
        platform: pushClient.platform,
        provider: 'onesignal',
      })
      if (error) {
        console.warn('[push] registerPushDevice failed', error)
        setPlayerId(null)
        return null
      }
      console.info('[push] device registered', { platform: pushClient.platform, playerId: id })
    } else {
      console.warn('[push] permission granted but no player/subscription id yet')
    }
    return id
  }, [])

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
      await rememberDecisionIfSettled()
      if (!granted) {
        return {
          ok: false,
          error:
            pushClient.getLastError?.() ||
            'Permission was denied. Enable notifications in system settings.',
        }
      }
      const id = await registerIfPossible(user.id, true)
      if (!id) {
        return {
          ok: false,
          error:
            pushClient.getLastError?.() ||
            'Could not save this browser as a push device. Sign in again, allow notifications, then retry.',
        }
      }
      setPermissionGranted(true)
      setSubscribePromptVisible(false)
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
      if (permitted) await rememberDecisionIfSettled()
    } catch (error) {
      console.warn('[push] syncDevice failed', error)
    }
  }, [isConfigured, registerIfPossible, user?.id])

  useEffect(() => {
    if (!clientReady || !configReady || !isConfigured) return
    const timer = setTimeout(() => {
      void pushClient.init().catch((error) => {
        console.warn('[push] early init failed', error)
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [clientReady, configReady, isConfigured])

  // Sign-out cleanup.
  useEffect(() => {
    if (!clientReady) return
    if (user?.id) return

    handledUserRef.current = null
    setPlayerId(null)
    setPermissionGranted(false)
    setSubscribePromptVisible(false)
    if (pushSessionActiveRef.current) {
      pushSessionActiveRef.current = false
      void pushClient.logout()
    }
  }, [clientReady, user?.id])

  /**
   * After sign-in: register if already allowed; otherwise show an in-app
   * subscribe dialog. Browsers block OS prompts without a user gesture, so web
   * never auto-calls requestPermission — the dialog button does.
   */
  useEffect(() => {
    if (!clientReady || !configReady || !isConfigured || !user?.id) return
    if (handledUserRef.current === user.id) return

    const userId = user.id
    let cancelled = false

    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (cancelled) return
          console.info('[push] login subscribe start', { platform: pushClient.platform, userId })

          await pushClient.init()
          if (cancelled) return

          await pushClient.login(userId)
          pushSessionActiveRef.current = true
          if (cancelled) return

          const permitted = await pushClient.getPermission()
          if (cancelled) return

          if (permitted) {
            const id = await registerIfPossible(userId, true)
            setPermissionGranted(!!id)
            setSubscribePromptVisible(!id)
            if (id) await markPushPermissionDecided()
            if (!cancelled) handledUserRef.current = userId
            console.info(
              id
                ? '[push] already permitted — registered device'
                : '[push] permitted in browser but device not registered — show prompt',
            )
            return
          }

          const canRequest = await pushClient.canRequestPermission()
          if (cancelled) return

          if (!canRequest) {
            await markPushPermissionDecided()
            if (!cancelled) handledUserRef.current = userId
            console.info('[push] cannot request permission (denied or unsupported)')
            return
          }

          const shouldPrompt = await shouldAutoPromptPush()
          if (cancelled) return

          // Always offer the in-app dialog when we can still request — browsers
          // require a click before their permission UI will appear.
          if (shouldPrompt) {
            setSubscribePromptVisible(true)
            console.info('[push] showing in-app subscribe prompt')
          }

          // Native can also present the system sheet without a gesture.
          if (Platform.OS !== 'web' && shouldPrompt) {
            console.info('[push] requesting OS permission')
            const granted = await pushClient.requestPermission()
            if (cancelled) return

            setPermissionGranted(granted)
            await rememberDecisionIfSettled()

            if (granted) {
              setSubscribePromptVisible(false)
              await registerIfPossible(userId, true)
              console.info('[push] permission granted — device registered')
            } else {
              console.info('[push] permission not granted — keep in-app prompt if needed')
            }
          }

          if (!cancelled) handledUserRef.current = userId
        } catch (error) {
          console.warn('[push] auto-subscribe on login failed', error)
        }
      })()
    }, 1_200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [clientReady, configReady, isConfigured, registerIfPossible, user?.id])

  useEffect(() => {
    if (!clientReady || !configReady || !isConfigured) return
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
  }, [clientReady, configReady, isConfigured])

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
      subscribePromptVisible,
      dismissSubscribePrompt,
      enablePush,
      disablePush,
      syncDevice,
    }),
    [
      disablePush,
      dismissSubscribePrompt,
      enablePush,
      isBusy,
      isConfigured,
      permissionGranted,
      playerId,
      subscribePromptVisible,
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
