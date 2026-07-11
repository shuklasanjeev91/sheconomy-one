import type { ReactNode } from 'react'

import { XStack } from 'tamagui'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogTitle,
} from './AlertDialog'
import { Button } from './Button'

type ConfirmDialogProps = {
  /** Uncontrolled: element that opens the dialog (rendered via `asChild`). */
  trigger?: ReactNode
  /** Controlled open state. Provide together with `onOpenChange`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}

/**
 * Cross-platform confirmation dialog for destructive actions (remove
 * connection, unfollow, etc.). Wraps the shared AlertDialog primitives. Works
 * either uncontrolled (via `trigger`) or controlled (via `open`/`onOpenChange`).
 */
export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const isControlled = open !== undefined

  return (
    <AlertDialog {...(isControlled ? { open, onOpenChange } : {})}>
      {trigger ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
          <XStack gap="$2" justifyContent="flex-end" marginTop="$2">
            <AlertDialog.Cancel asChild>
              <Button tone="secondary">{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button tone={destructive ? 'destructive' : 'primary'} onPress={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </XStack>
        </AlertDialogContent>
      </AlertDialog.Portal>
    </AlertDialog>
  )
}
