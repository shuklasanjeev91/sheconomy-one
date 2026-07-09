import { Dialog as TDialog, styled } from 'tamagui'
import { getShadowStyle } from '~/config/tokens'

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

export const DialogContent = styled(
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