import type { PushPlatform } from '~/lib/notifications/push-config'

export type PushClickPayload = {
  url?: string | null
  notificationId?: string | null
  title?: string | null
  body?: string | null
  data?: Record<string, unknown> | null
}

export type PushClient = {
  /** Initialize the platform SDK (idempotent). */
  init: () => Promise<void>
  /** Ask OS permission + opt in. Returns whether permission was granted. */
  requestPermission: () => Promise<boolean>
  /** Current OS permission for push. */
  getPermission: () => Promise<boolean>
  /** Bind the OneSignal user to our auth user id. */
  login: (userId: string) => Promise<void>
  /** Clear external user binding (on sign-out). */
  logout: () => Promise<void>
  /** OneSignal subscription / player id used by the REST dispatcher. */
  getPlayerId: () => Promise<string | null>
  /** Opt out of push on this device without clearing the SDK entirely. */
  optOut: () => Promise<void>
  /** Re-enable push after opt-out (if still permitted). */
  optIn: () => Promise<void>
  /** Listen for notification taps (deep links). Returns unsubscribe. */
  onNotificationClick: (handler: (payload: PushClickPayload) => void) => () => void
  platform: PushPlatform
}
