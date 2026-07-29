import { useState, type ReactNode } from 'react'

import { AppBottomSheet } from '~/components/ui/BottomSheet'
import { Button } from '~/components/ui/Button'
import { Text } from '~/components/ui/Text'
import { XStack, YStack } from 'tamagui'

type ConfirmDialogProps = {
  /** Uncontrolled: element that opens the sheet (pressable). */
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
 * Cross-platform confirmation — always a bottom sheet on web, iOS, and Android.
 * Works either uncontrolled (via `trigger`) or controlled (`open`/`onOpenChange`).
 */
export function ConfirmDialog({
  trigger,
  open: openProp,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const isControlled = openProp !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = isControlled ? Boolean(openProp) : uncontrolledOpen

  function setOpen(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  return (
    <>
      {trigger ? (
        <YStack asChild onPress={() => setOpen(true)}>
          {trigger}
        </YStack>
      ) : null}

      <AppBottomSheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        scrollable={false}
        footer={
          <XStack gap="$2" width="100%">
            <Button tone="secondary" flex={1} onPress={() => setOpen(false)}>
              {cancelLabel}
            </Button>
            <Button
              tone={destructive ? 'destructive' : 'primary'}
              flex={1}
              onPress={() => {
                onConfirm()
                setOpen(false)
              }}
            >
              {confirmLabel}
            </Button>
          </XStack>
        }
      >
        {description ? (
          <Text fontSize={15} lineHeight={22} color="$color11">
            {description}
          </Text>
        ) : null}
      </AppBottomSheet>
    </>
  )
}
