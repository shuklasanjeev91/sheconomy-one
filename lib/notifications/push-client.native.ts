import type { PushClient, PushClickPayload } from '~/lib/notifications/push-client.types'
import { getOneSignalAppId, resolvePushPlatform } from '~/lib/notifications/push-config'

let initialized = false

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
      const granted = await OneSignal.Notifications.requestPermission(true)
      if (granted) OneSignal.User.pushSubscription.optIn()
      return granted
    } catch {
      return false
    }
  },

  async getPermission() {
    try {
      const { OneSignal } = await import('react-native-onesignal')
      await this.init()
      return await OneSignal.Notifications.getPermissionAsync()
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
    try {
      const { OneSignal } = await import('react-native-onesignal')
      OneSignal.logout()
    } catch {
      // ignore
    }
  },

  async getPlayerId() {
    try {
      const { OneSignal } = await import('react-native-onesignal')
      await this.init()
      return await OneSignal.User.pushSubscription.getIdAsync()
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
}

export default nativePushClient
