import { Sheet as TSheet, styled } from 'tamagui'

/** Bottom sheet — the natural "modal" pattern on mobile, also great on web. */
export const Sheet = TSheet

export const SheetOverlay = styled(
  TSheet.Overlay,
  {
    name: 'SheetOverlay',
    backgroundColor: 'rgba(10, 10, 15, 0.5)',
    animation: 'quick',
    enterStyle: { opacity: 0 },
    exitStyle: { opacity: 0 },
  } as any
)

export const SheetFrame = styled(TSheet.Frame, {
  name: 'SheetFrame',
  backgroundColor: '$background',
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  padding: 0,
  margin: 0,
  gap: '$3',
})

export const SheetHandle = styled(TSheet.Handle, {
  name: 'SheetHandle',
  backgroundColor: '$color6',
  width: 40,
})