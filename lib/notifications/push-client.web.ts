import type { PushClient, PushClickPayload } from '~/lib/notifications/push-client.types'
import { getOneSignalAppId } from '~/lib/notifications/push-config'

let initialized = false
let initPromise: Promise<void> | null = null

async function loadOneSignal() {
  const mod = await import('react-onesignal')
  return mod.default
}

/**
 * Web OneSignal push client (Chrome / Edge / Firefox / Safari where supported).
 */
const webPushClient: PushClient = {
  platform: 'web',

  async init() {
    if (typeof window === 'undefined') return
    const appId = getOneSignalAppId()
    if (!appId) return
    if (initialized) return
    if (initPromise) return initPromise

    initPromise = (async () => {
      try {
        const OneSignal = await loadOneSignal()
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
          serviceWorkerParam: { scope: '/' },
          welcomeNotification: { disable: true },
        })
        initialized = true
      } catch (error) {
        console.warn('[push] Web OneSignal init failed', error)
        initPromise = null
      }
    })()

    return initPromise
  },

  async requestPermission() {
    try {
      const OneSignal = await loadOneSignal()
      await this.init()
      if (!OneSignal.Notifications.isPushSupported()) return false
      const granted = await OneSignal.Notifications.requestPermission()
      if (granted) await OneSignal.User.PushSubscription.optIn()
      return granted
    } catch {
      return false
    }
  },

  async getPermission() {
    try {
      const OneSignal = await loadOneSignal()
      await this.init()
      return !!OneSignal.Notifications.permission
    } catch {
      return false
    }
  },

  async login(userId: string) {
    try {
      const OneSignal = await loadOneSignal()
      await this.init()
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
      const OneSignal = await loadOneSignal()
      await this.init()
      return OneSignal.User.PushSubscription.id ?? null
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
      const OneSignal = await loadOneSignal()
      await OneSignal.User.PushSubscription.optIn()
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
}

export default webPushClient
