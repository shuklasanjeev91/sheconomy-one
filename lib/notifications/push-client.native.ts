import type { PushClient, PushClickPayload } from '~/lib/notifications/push-client.types'
import { getOneSignalAppId, resolvePushPlatform } from '~/lib/notifications/push-config'

let initialized = false

async function waitForSubscriptionId(timeoutMs = 8_000): Promise<string | null> {
  const { OneSignal } = await import('react-native-onesignal')

  const existing = await OneSignal.User.pushSubscription.getIdAsync()
  if (existing) return existing

  return new Promise((resolve) => {
    let settled = false
    const finish = (id: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        OneSignal.User.pushSubscription.removeEventListener('change', onChange)
      } catch {
        // ignore
      }
      resolve(id)
    }

    const onChange = (state: { current?: { id?: string | null } }) => {
      const id = state.current?.id
      if (id) finish(id)
    }

    const timer = setTimeout(() => {
      void OneSignal.User.pushSubscription.getIdAsync().then((id) => finish(id ?? null))
    }, timeoutMs)

    try {
      OneSignal.User.pushSubscription.addEventListener('change', onChange)
    } catch {
      finish(null)
    }
  })
}

/**
 * Native (iOS / Android) OneSignal push client.
 * Requires a development/production build — not available inside Expo Go.
 */
const nativePushClient: PushClient = {
  platform: resolvePushPlatform(),

  async init() {
    const appId = getOneSignalAppId()
    if (!appId || initialized) return
    try {
      const { OneSignal, LogLevel } = await import('react-native-onesignal')
      OneSignal.Debug.setLogLevel(LogLevel.Warn)
      OneSignal.initialize(appId)
      initialized = true
    } catch (error) {
      console.warn('[push] Native OneSignal init failed', error)
    }
  },

  async requestPermission() {
    try {
      const { OneSignal } = await import('react-native-onesignal')
      await this.init()
      // true = fallback to settings if previously denied on some Android versions.
      const granted = await OneSignal.Notifications.requestPermission(true)
      if (granted) {
        try {
          OneSignal.User.pushSubscription.optIn()
        } catch (error) {
          console.warn('[push] Native optIn after grant failed', error)
        }
      }
      return !!granted
    } catch (error) {
      console.warn('[push] Native requestPermission failed', error)
      return false
    }
  },

  async getPermission() {
    try {
      const { OneSignal } = await import('react-native-onesignal')
      await this.init()
      return !!(await OneSignal.Notifications.getPermissionAsync())
    } catch {
      return false
    }
  },

  async canRequestPermission() {
    try {
      const { OneSignal } = await import('react-native-onesignal')
      await this.init()
      // If the SDK helper fails, fall back to “not yet granted”.
      try {
        return !!(await OneSignal.Notifications.canRequestPermission())
      } catch {
        return !(await OneSignal.Notifications.getPermissionAsync())
      }
    } catch {
      return false
    }
  },

  async login(userId: string) {
    try {
      const { OneSignal } = await import('react-native-onesignal')
      await this.init()
      OneSignal.login(userId)
    } catch (error) {
      console.warn('[push] Native login failed', error)
    }
  },

  async logout() {
    // OneSignal throws IllegalStateException if logout runs before initialize.
    if (!initialized) return
    try {
      const { OneSignal } = await import('react-native-onesignal')
      OneSignal.logout()
    } catch {
      // ignore
    }
  },

  async getPlayerId() {
    try {
      await this.init()
      return await waitForSubscriptionId(6_000)
    } catch {
      return null
    }
  },

  async optOut() {
    try {
      const { OneSignal } = await import('react-native-onesignal')
      OneSignal.User.pushSubscription.optOut()
    } catch {
      // ignore
    }
  },

  async optIn() {
    try {
      const { OneSignal } = await import('react-native-onesignal')
      OneSignal.User.pushSubscription.optIn()
    } catch {
      // ignore
    }
  },

  onNotificationClick(handler: (payload: PushClickPayload) => void) {
    let unsubscribe = () => {}
    void (async () => {
      try {
        const { OneSignal } = await import('react-native-onesignal')
        await this.init()
        const listener = (event: {
          result?: { url?: string }
          notification?: {
            notificationId?: string
            title?: string
            body?: string
            additionalData?: Record<string, unknown>
            launchURL?: string
          }
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
        const { OneSignal } = await import('react-native-onesignal')
        await this.init()
        const listener = (event: {
          preventDefault?: () => void
          getNotification?: () => {
            notificationId?: string
            title?: string
            body?: string
            additionalData?: Record<string, unknown>
            launchURL?: string
          }
        }) => {
          event.preventDefault?.()
          const notification = event.getNotification?.() ?? null
          const data = notification?.additionalData ?? null
          const url =
            notification?.launchURL ||
            (typeof data?.url === 'string' ? data.url : null) ||
            (typeof data?.action_url === 'string' ? data.action_url : null)
          handler({
            url,
            notificationId: notification?.notificationId ?? null,
            title: notification?.title ?? null,
            body: notification?.body ?? null,
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

export default nativePushClient
