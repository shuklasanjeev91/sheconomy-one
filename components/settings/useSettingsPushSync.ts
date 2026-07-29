import { useAppToast } from '~/components/ui'
import { resetPushPermissionMemory } from '~/lib/notifications/push-auto-prompt'
import { usePushNotifications } from '~/providers/PushNotificationsProvider'

/** Shared device push enable/disable used by notification preference panels. */
export function useSettingsPushSync() {
  const toast = useAppToast()
  const {
    isConfigured: pushConfigured,
    permissionGranted,
    playerId,
    isBusy: pushBusy,
    enablePush,
    disablePush,
  } = usePushNotifications()

  // Only treat push as ON when we have a saved OneSignal subscription id.
  const pushEnabled = permissionGranted && !!playerId

  async function syncDevicePush(enabled: boolean): Promise<boolean> {
    if (enabled) {
      // Allow Settings to request again when the OS still permits it.
      await resetPushPermissionMemory()
      const result = await enablePush()
      if (!result.ok) {
        toast.show('Could not enable push', { tone: 'danger', message: result.error })
        return false
      }
      toast.show('Push notifications enabled', { tone: 'success' })
      return true
    }
    const result = await disablePush()
    if (!result.ok) {
      toast.show('Could not disable push', { tone: 'danger', message: result.error })
      return false
    }
    return true
  }

  return {
    pushConfigured,
    permissionGranted: pushEnabled,
    pushBusy,
    syncDevicePush,
  }
}
