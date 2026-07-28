import { useState } from 'react'
import { XStack, YStack } from 'tamagui'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogTitle,
} from '~/components/ui/AlertDialog'
import { Button } from '~/components/ui/Button'
import { markPushPermissionDecided } from '~/lib/notifications/push-auto-prompt'
import { usePushNotifications } from '~/providers/PushNotificationsProvider'

/**
 * In-app push opt-in. Browsers block OS permission prompts without a user
 * gesture, so we ask here first, then call enablePush() from the button press.
 */
export function PushSubscribePromptHost() {
  const { isConfigured, permissionGranted, isBusy, subscribePromptVisible, dismissSubscribePrompt, enablePush } =
    usePushNotifications()
  const [busy, setBusy] = useState(false)

  const open =
    isConfigured && subscribePromptVisible && !permissionGranted && !isBusy

  async function onAllow() {
    setBusy(true)
    try {
      const result = await enablePush()
      if (result.ok) {
        dismissSubscribePrompt()
      }
    } finally {
      setBusy(false)
    }
  }

  async function onLater() {
    await markPushPermissionDecided()
    dismissSubscribePrompt()
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void onLater()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <YStack gap="$3">
            <AlertDialogTitle>Turn on notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              Get alerts for messages, orders, calls, and reminders — even when the app is in the
              background.
            </AlertDialogDescription>
            <XStack gap="$2" justifyContent="flex-end" marginTop="$2" flexWrap="wrap">
              <Button tone="secondary" disabled={busy} onPress={() => void onLater()}>
                Not now
              </Button>
              <Button tone="primary" disabled={busy} onPress={() => void onAllow()}>
                {busy ? 'Enabling…' : 'Allow notifications'}
              </Button>
            </XStack>
          </YStack>
        </AlertDialogContent>
      </AlertDialog.Portal>
    </AlertDialog>
  )
}
