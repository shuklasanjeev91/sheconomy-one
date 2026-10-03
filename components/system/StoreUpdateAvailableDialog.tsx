import { Platform } from 'react-native'
import { XStack, YStack } from 'tamagui'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogTitle,
} from '~/components/ui/AlertDialog'
import { Button } from '~/components/ui/Button'

type StoreUpdateAvailableDialogProps = {
  open: boolean
  latestVersion: string
  currentVersion: string
  onUpdate: () => void
  onLater: () => void
}

/** Dismissible nudge when a newer store build exists but is not yet required. */
export function StoreUpdateAvailableDialog({
  open,
  latestVersion,
  currentVersion,
  onUpdate,
  onLater,
}: StoreUpdateAvailableDialogProps) {
  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Play Store'

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onLater()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <YStack gap="$3">
            <AlertDialogTitle>New version available</AlertDialogTitle>
            <AlertDialogDescription>
              SHEconomy {latestVersion} is available on the {storeName}. You are on{' '}
              {currentVersion}. Update now for the latest features and fixes.
            </AlertDialogDescription>
            <XStack gap="$2" justifyContent="flex-end" marginTop="$2" flexWrap="wrap">
              <Button tone="secondary" onPress={onLater}>
                Later
              </Button>
              <Button tone="primary" onPress={onUpdate}>
                Update
              </Button>
            </XStack>
          </YStack>
        </AlertDialogContent>
      </AlertDialog.Portal>
    </AlertDialog>
  )
}
