import { useEffect } from 'react'

import { isIncomingCallPush } from '~/chat/lib/incoming-call-push'
import pushClient from '~/lib/notifications/push-client'
import { pathFromNotificationUrl } from '~/lib/notifications/push-config'
import { navigateApp } from '~/lib/platform/navigate'
import { useAppToast } from '~/components/ui'
import { usePushNotifications } from '~/providers/PushNotificationsProvider'

/**
 * Shows in-app toasts when a push arrives while the app is foregrounded.
 * Incoming calls use CallOverlay / CallKit instead (IncomingCallHost).
 * Must render inside ToastProvider.
 */
export function PushForegroundNotificationHost() {
  const toast = useAppToast()
  const { isConfigured } = usePushNotifications()

  useEffect(() => {
    if (!isConfigured) return
    return pushClient.onForegroundNotification((payload) => {
      // Let IncomingCallHost / CallOverlay / CallKeep own the ringing UX.
      if (isIncomingCallPush(payload)) return

      const title = payload.title?.trim() || 'New notification'
      const message = payload.body?.trim() || undefined
      const path = pathFromNotificationUrl(payload.url)
      toast.show(title, {
        message,
        tone: 'info',
        duration: 5500,
        onPress: path
          ? () => {
              try {
                navigateApp(path)
              } catch {
                // ignore navigation failures
              }
            }
          : undefined,
      })
    })
  }, [isConfigured, toast])

  return null
}
