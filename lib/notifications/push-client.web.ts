import type { PushClient, PushClickPayload } from '~/lib/notifications/push-client.types'
import { fetchOneSignalConfig, resolveOneSignalAppId } from '~/lib/notifications/push-config'
import { registerPwaServiceWorker } from '~/lib/pwa/register'

let initialized = false
let initPromise: Promise<void> | null = null
let lastWebPushError: string | null = null

export function getLastWebPushError(): string | null {
  return lastWebPushError
}

function setLastError(message: string | null) {
  lastWebPushError = message
  if (message) console.warn('[push]', message)
}

async function loadOneSignal() {
  const mod = await import('react-onesignal')
  return mod.default
}

async function waitForWebSubscriptionId(timeoutMs = 15_000): Promise<string | null> {
  const OneSignal = await loadOneSignal()
  const existing = OneSignal.User.PushSubscription.id
  if (existing) return existing

  return new Promise((resolve) => {
    let settled = false
    const finish = (id: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearInterval(poll)
      try {
        OneSignal.User.PushSubscription.removeEventListener('change', onChange)
      } catch {
        // ignore
      }
      resolve(id)
    }

    const onChange = (event: { current?: { id?: string | null } }) => {
      const id = event.current?.id
      if (id) finish(id)
    }

    const poll = setInterval(() => {
      const id = OneSignal.User.PushSubscription.id
      if (id) finish(id)
    }, 350)

    const timer = setTimeout(() => {
      finish(OneSignal.User.PushSubscription.id ?? null)
    }, timeoutMs)

    try {
      OneSignal.User.PushSubscription.addEventListener('change', onChange)
    } catch {
      finish(null)
    }
  })
}

async function ensureServiceWorker(): Promise<void> {
  // Shared with PWA bootstrap — OneSignal + offline shell share this worker.
  const registration = await registerPwaServiceWorker()
  if (!registration) {
    throw new Error('This browser does not support service workers (required for web push).')
  }
}

/**
 * Web OneSignal push client (Chrome / Edge / Firefox / Safari where supported).
 */
const webPushClient: PushClient = {
  platform: 'web',

  getLastError: () => lastWebPushError,

  async init() {
    if (typeof window === 'undefined') return
    if (initialized) return
    if (initPromise) return initPromise

    initPromise = (async () => {
      try {
        const config = await fetchOneSignalConfig()
        const appId = config.appId ?? (await resolveOneSignalAppId())
        if (!appId) {
          setLastError('OneSignal App ID missing from Supabase secrets / env.')
          return
        }

        const OneSignal = await loadOneSignal()
        try {
          OneSignal.Debug.setLogLevel('warn')
        } catch {
          // ignore
        }

        try {
          await ensureServiceWorker()
        } catch (error) {
          setLastError(error instanceof Error ? error.message : 'Service worker registration failed')
          // Still try init — OneSignal may register its own worker.
        }

        await OneSignal.init({
          appId,
          ...(config.safariWebId ? { safari_web_id: config.safariWebId } : {}),
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          autoRegister: true,
          serviceWorkerPath: 'OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/' },
          notificationClickHandlerMatch: 'origin',
          notificationClickHandlerAction: 'focus',
          welcomeNotification: {
            disable: true,
            message: '',
          },
        })
        initialized = true
        setLastError(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // HMR / remount can re-enter init after the SDK already booted.
        if (/already (been )?initialized/i.test(message)) {
          initialized = true
          setLastError(null)
          return
        }
        setLastError(`OneSignal init failed: ${message}`)
        initPromise = null
      }
    })()

    return initPromise
  },

  async requestPermission() {
    try {
      setLastError(null)
      const OneSignal = await loadOneSignal()
      await this.init()
      if (!initialized) {
        setLastError(
          getLastWebPushError() ||
            'OneSignal failed to initialize. Confirm Web Push is enabled in the OneSignal dashboard.',
        )
        return false
      }
      if (!OneSignal.Notifications.isPushSupported()) {
        setLastError('Web push is not supported in this browser.')
        return false
      }

      // Prefer the native browser prompt while we still have a user gesture
      // (Settings toggle / Allow button). OneSignal's wrapper can miss that.
      const nativePermission =
        typeof Notification !== 'undefined' ? Notification.permission : 'default'

      if (nativePermission === 'denied') {
        setLastError(
          'Notifications are blocked for this site. Click the lock icon in the address bar → Site settings → Notifications → Allow, then try again.',
        )
        return false
      }

      if (nativePermission === 'default') {
        const result = await Notification.requestPermission()
        if (result !== 'granted') {
          setLastError(
            result === 'denied'
              ? 'Notifications are blocked for this site. Allow them in the browser site settings, then try again.'
              : 'Notification permission was not granted.',
          )
          return false
        }
      }

      // Sync OneSignal with the browser permission + create push subscription.
      try {
        await OneSignal.Notifications.requestPermission()
      } catch (error) {
        console.warn('[push] OneSignal.requestPermission after grant failed', error)
      }
      try {
        await OneSignal.User.PushSubscription.optIn()
      } catch (error) {
        console.warn('[push] Web optIn failed', error)
      }

      const id = await waitForWebSubscriptionId(15_000)
      if (!id) {
        setLastError(
          'Browser allowed notifications, but no OneSignal subscription was created. In OneSignal → Settings → Platforms, enable Web, add this site (localhost:8081 for local), then retry.',
        )
        return false
      }

      setLastError(null)
      return true
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Failed to enable web push')
      return false
    }
  },

  async getPermission() {
    try {
      const OneSignal = await loadOneSignal()
      await this.init()
      if (!initialized) return false
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') return true
      if (OneSignal.Notifications.permissionNative === 'granted') return true
      return !!OneSignal.Notifications.permission
    } catch {
      return false
    }
  },

  async canRequestPermission() {
    try {
      await this.init()
      if (!initialized) return false
      if (typeof Notification === 'undefined') return false
      if (!('PushManager' in window)) return false
      // Denied in browser → only fixable via site settings, not our prompt.
      if (Notification.permission === 'denied') return false
      // Always allow Settings → Enable to (re)subscribe when not denied.
      return true
    } catch {
      return false
    }
  },

  async login(userId: string) {
    try {
      const OneSignal = await loadOneSignal()
      await this.init()
      if (!initialized) return
      await OneSignal.login(userId)
    } catch (error) {
      console.warn('[push] Web login failed', error)
    }
  },

  async logout() {
    try {
      const OneSignal = await loadOneSignal()
      if (!initialized) return
      await OneSignal.logout()
    } catch {
      // ignore
    }
  },

  async getPlayerId() {
    try {
      await this.init()
      if (!initialized) return null
      return await waitForWebSubscriptionId(12_000)
    } catch {
      return null
    }
  },

  async optOut() {
    try {
      const OneSignal = await loadOneSignal()
      await OneSignal.User.PushSubscription.optOut()
    } catch {
      // ignore
    }
  },

  async optIn() {
    try {
      await this.init()
      if (!initialized) return
      const OneSignal = await loadOneSignal()
      await OneSignal.User.PushSubscription.optIn()
      await waitForWebSubscriptionId(12_000)
    } catch {
      // ignore
    }
  },

  onNotificationClick(handler: (payload: PushClickPayload) => void) {
    let unsubscribe = () => {}
    void (async () => {
      try {
        const OneSignal = await loadOneSignal()
        await this.init()
        const listener = (event: {
          notification?: {
            notificationId?: string
            title?: string
            body?: string
            launchURL?: string
            additionalData?: Record<string, unknown>
          }
          result?: { url?: string }
        }) => {
          const data = event.notification?.additionalData ?? null
          const url =
            event.result?.url ||
            event.notification?.launchURL ||
            (typeof data?.url === 'string' ? data.url : null) ||
            (typeof data?.action_url === 'string' ? data.action_url : null)
          handler({
            url,
            notificationId: event.notification?.notificationId ?? null,
            title: event.notification?.title ?? null,
            body: event.notification?.body ?? null,
            data,
          })
        }
        OneSignal.Notifications.addEventListener('click', listener)
        unsubscribe = () => {
          OneSignal.Notifications.removeEventListener('click', listener)
        }
      } catch {
        // ignore
      }
    })()
    return () => unsubscribe()
  },

  onForegroundNotification(handler: (payload: PushClickPayload) => void) {
    let unsubscribe = () => {}
    void (async () => {
      try {
        const OneSignal = await loadOneSignal()
        await this.init()
        const listener = (event: {
          notification?: {
            notificationId?: string
            title?: string
            body?: string
            launchURL?: string
            additionalData?: Record<string, unknown>
            display?: () => void
          }
        }) => {
          try {
            event.notification?.display?.()
          } catch {
            // ignore
          }
          const data = event.notification?.additionalData ?? null
          const url =
            event.notification?.launchURL ||
            (typeof data?.url === 'string' ? data.url : null) ||
            (typeof data?.action_url === 'string' ? data.action_url : null)
          handler({
            url,
            notificationId: event.notification?.notificationId ?? null,
            title: event.notification?.title ?? null,
            body: event.notification?.body ?? null,
            data,
          })
        }
        OneSignal.Notifications.addEventListener('foregroundWillDisplay', listener)
        unsubscribe = () => {
          OneSignal.Notifications.removeEventListener('foregroundWillDisplay', listener)
        }
      } catch {
        // ignore
      }
    })()
    return () => unsubscribe()
  },
}

export default webPushClient
