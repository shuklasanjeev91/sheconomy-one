import { useState } from 'react'
import { Platform } from 'react-native'

import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePushNotifications } from '~/providers/PushNotificationsProvider'
import { useSupabase } from '~/providers/SupabaseProvider'

/**
 * Soft prompt to enable push on web / iOS / Android after sign-in.
 * Hidden once the device already has permission.
 */
export function PushPermissionBanner() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const { isConfigured, permissionGranted, isBusy, enablePush } = usePushNotifications()
  const [dismissed, setDismissed] = useState(false)

  if (!user || !isConfigured || permissionGranted || dismissed) return null

  const platformLabel =
    Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : 'this browser'

  return (
    <YStack
      width="100%"
      padding="$3.5"
      gap="$3"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <XStack gap="$2.5" alignItems="flex-start">
        <Icons.Bell size={18} color={ui.brand} />
        <YStack flex={1} gap={4}>
          <Text fontWeight="700" fontSize={15} color={ui.text}>
            Stay updated on {platformLabel}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
            Turn on push for Commerce orders, Community updates, Chat messages, Class lessons,
            Co-Work meetings, and shop alerts across web, iOS, and Android.
          </Text>
        </YStack>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        <Button
          tone="primary"
          size="$3"
          borderRadius={999}
          disabled={isBusy}
          icon={isBusy ? <Spinner size="small" color="white" /> : undefined}
          onPress={async () => {
            const result = await enablePush()
            if (!result.ok) {
              toast.show('Could not enable push', {
                tone: 'danger',
                message: result.error,
              })
              return
            }
            toast.show('Push enabled', { tone: 'success' })
          }}
        >
          Enable push
        </Button>
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          disabled={isBusy}
          onPress={() => setDismissed(true)}
        >
          Not now
        </Button>
      </XStack>
    </YStack>
  )
}
