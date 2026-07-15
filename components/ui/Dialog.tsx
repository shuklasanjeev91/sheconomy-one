import type { ComponentProps, ReactNode } from 'react'
import { Dialog as TDialog, styled, XStack } from 'tamagui'

import * as Icons from '@tamagui/lucide-icons'
import { getShadowStyle, radius } from '~/config/tokens'

/**
 * Restyled Tamagui Dialog — same compound API (`Dialog.Trigger`,
 * `Dialog.Content`, …), just with a softer overlay + a premium elevated
 * content card and default enter/exit animations wired up.
 */
export const Dialog = TDialog

export const DialogOverlay = styled(
  TDialog.Overlay,
  {
    name: 'DialogOverlay',
    backgroundColor: 'rgba(10, 10, 15, 0.5)',
    animation: 'quick',
    enterStyle: { opacity: 0 },
    exitStyle: { opacity: 0 },
  } as any
)

const StyledDialogContent = styled(
  TDialog.Content,
  {
    name: 'DialogContent',
    backgroundColor: '$background',
    borderRadius: '$8',
    borderWidth: 1,
    borderColor: '$borderColor',
    padding: '$5',
    gap: '$3',
    maxWidth: 480,
    width: '90%',
    animation: 'quick',
    enterStyle: { opacity: 0, scale: 0.96, y: 8 },
    exitStyle: { opacity: 0, scale: 0.96, y: 8 },
    ...getShadowStyle('lg'),
  } as any
)

export function DialogCloseButton({ label = 'Close dialog' }: { label?: string }) {
  return (
    <Dialog.Close asChild>
      <XStack
        position="absolute"
        top="$3"
        right="$3"
        zIndex={20}
        width={36}
        height={36}
        alignItems="center"
        justifyContent="center"
        borderRadius={radius.pill}
        cursor="pointer"
        hoverStyle={{ backgroundColor: '$color3' }}
        pressStyle={{ opacity: 0.75, scale: 0.94 }}
        animation="quick"
        aria-label={label}
      >
        <Icons.X size={20} color="$color11" />
      </XStack>
    </Dialog.Close>
  )
}

export function DialogContent({
  children,
  showClose = true,
  closeLabel,
  ...props
}: ComponentProps<typeof StyledDialogContent> & {
  showClose?: boolean
  closeLabel?: string
  children?: ReactNode
}) {
  const paddingRight = props.padding === 0 || props.padding === '$0' ? props.paddingRight : showClose ? props.paddingRight ?? '$8' : props.paddingRight

  return (
    <StyledDialogContent position="relative" {...props} paddingRight={paddingRight}>
      {showClose ? <DialogCloseButton label={closeLabel} /> : null}
      {children}
    </StyledDialogContent>
  )
}

export const DialogTitle = styled(TDialog.Title, {
  name: 'DialogTitle',
  fontSize: '$6',
  fontWeight: '700',
})

export const DialogDescription = styled(TDialog.Description, {
  name: 'DialogDescription',
  color: '$color11',
  fontSize: '$4',
  lineHeight: '$5',
})
