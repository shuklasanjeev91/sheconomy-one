import { XStack, YStack } from 'tamagui'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogTitle,
} from '~/components/ui/AlertDialog'
import { Button } from '~/components/ui/Button'

type UpdatePromptDialogProps = {
  open: boolean
  critical: boolean
  busy?: boolean
  onRestart: () => void
  onLater?: () => void
}

/**
 * Lightweight OTA restart prompt using the shared AlertDialog design system.
 */
export function UpdatePromptDialog({
  open,
  critical,
  busy = false,
  onRestart,
  onLater,
}: UpdatePromptDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && critical) return
      }}
    >
      <AlertDialog.Portal>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <YStack gap="$3">
            <AlertDialogTitle>
              {critical ? 'Important update ready' : 'Update ready'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {critical
                ? 'An important application update is ready and must be installed to continue.'
                : 'A new update is ready. Restart the app to apply it.'}
            </AlertDialogDescription>
            <XStack gap="$2" justifyContent="flex-end" marginTop="$2" flexWrap="wrap">
              {!critical && onLater ? (
                <Button tone="secondary" disabled={busy} onPress={onLater}>
                  Later
                </Button>
              ) : null}
              <Button tone="primary" disabled={busy} onPress={onRestart}>
                {critical ? 'Update and Restart' : 'Restart Now'}
              </Button>
            </XStack>
          </YStack>
        </AlertDialogContent>
      </AlertDialog.Portal>
    </AlertDialog>
  )
}
