import { AlertDialog as TAlertDialog, styled } from 'tamagui'
import { getShadowStyle } from '~/config/tokens'

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

export const AlertDialogContent = styled(
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