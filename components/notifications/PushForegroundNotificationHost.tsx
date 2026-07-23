import { useEffect } from 'react'

import pushClient from '~/lib/notifications/push-client'
import { getOneSignalAppId, pathFromNotificationUrl } from '~/lib/notifications/push-config'
import { navigateApp } from '~/lib/platform/navigate'
import { useAppToast } from '~/components/ui'

/**
 * Shows in-app toasts when a push arrives while the app is foregrounded.
 * Must render inside ToastProvider.
 */
export function PushForegroundNotificationHost() {
  const toast = useAppToast()
  const isConfigured = !!getOneSignalAppId()

  useEffect(() => {
    if (!isConfigured) return
    return pushClient.onForegroundNotification((payload) => {
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
