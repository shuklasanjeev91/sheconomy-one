import { Sheet as TSheet, styled } from 'tamagui'
import { Platform } from 'react-native'

const overlayAnimation = Platform.OS === 'web' ? 'quick' : '75ms'

/** Bottom sheet — the natural "modal" pattern on mobile, also great on web. */
export const Sheet = TSheet

export const SheetOverlay = styled(
  TSheet.Overlay,
  {
    name: 'SheetOverlay',
    backgroundColor: 'rgba(10, 10, 15, 0.45)',
    animation: overlayAnimation,
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
