import type { ComponentProps, ReactNode } from 'react'
import { Platform } from 'react-native'
import { AlertDialog as TAlertDialog, styled, XStack } from 'tamagui'

import * as Icons from '@tamagui/lucide-icons'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { isNativeFullscreenOverlay } from '~/lib/platform/native-fullscreen'

/** For destructive/confirmation flows — cannot be dismissed by outside click. */
export const AlertDialog = TAlertDialog

export const AlertDialogOverlay = styled(
  TAlertDialog.Overlay,
  {
    name: 'AlertDialogOverlay',
    backgroundColor: 'rgba(10, 10, 15, 0.5)',
    animation: 'quick',
    enterStyle: { opacity: 0 },
    exitStyle: { opacity: 0 },
  } as any
)

const StyledAlertDialogContent = styled(
  TAlertDialog.Content,
  {
    name: 'AlertDialogContent',
    backgroundColor: '$background',
    borderRadius: '$8',
    padding: '$5',
    gap: '$3',
    maxWidth: 420,
    width: '90%',
    animation: 'quick',
    enterStyle: { opacity: 0, scale: 0.96 },
    exitStyle: { opacity: 0, scale: 0.96 },
    ...getShadowStyle('lg'),
  } as any
)

export function AlertDialogCloseButton({ label = 'Close dialog' }: { label?: string }) {
  return (
    <AlertDialog.Cancel asChild>
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
    </AlertDialog.Cancel>
  )
}

export function AlertDialogContent({
  children,
  showClose = true,
  closeLabel,
  ...props
}: ComponentProps<typeof StyledAlertDialogContent> & {
  showClose?: boolean
  closeLabel?: string
  children?: ReactNode
}) {
  const { safeTop, safeBottom } = useAppLayout()

  const nativeFullscreenProps =
    isNativeFullscreenOverlay
      ? {
          width: '100%' as const,
          height: '100%' as const,
          maxWidth: '100%' as const,
          maxHeight: '100%' as const,
          borderRadius: 0,
          paddingTop: Math.max(safeTop, 16),
          paddingBottom: Math.max(safeBottom, 16),
          ...(Platform.OS !== 'web' ? { flex: 1 } : null),
        }
      : null

  return (
    <StyledAlertDialogContent
      position="relative"
      {...props}
      {...nativeFullscreenProps}
      paddingRight={showClose ? props.paddingRight ?? '$8' : props.paddingRight}
    >
      {showClose ? <AlertDialogCloseButton label={closeLabel} /> : null}
      {children}
    </StyledAlertDialogContent>
  )
}

export const AlertDialogTitle = styled(TAlertDialog.Title, {
  name: 'AlertDialogTitle',
  fontSize: '$6',
  fontWeight: '700',
})

export const AlertDialogDescription = styled(TAlertDialog.Description, {
  name: 'AlertDialogDescription',
  color: '$color11',
  fontSize: '$4',
})
