import type { ReactNode } from 'react'

import { Adapt, XStack, useSheet } from 'tamagui'

import * as Icons from '~/components/ui/icons'
import { Sheet, SheetFrame, SheetHandle, SheetOverlay } from '~/components/ui/Sheet'
import { radius } from '~/config/tokens'
import { useFullscreenOverlayInsets } from '~/hooks/useFullscreenOverlayInsets'
import { useFullscreenOverlaySize } from '~/hooks/useFullscreenOverlaySize'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * Close control for the adapted sheet.
 *
 * Lives inside the frame so it can read the sheet's own context. Dragging the
 * handle or hitting the overlay were the only ways out before, which is
 * undiscoverable on Android. `setOpen` also closes the Select / Popover that
 * adapted into this sheet, exactly like an overlay press does.
 */
function AdaptSheetClose({ topInset }: { topInset: number }) {
  const ui = useAppUi()
  const sheet = useSheet()

  return (
    <XStack
      position="absolute"
      // Offset explicitly rather than inheriting the frame's padding, so the
      // button clears the status bar on Android edge-to-edge either way.
      top={topInset + 8}
      right={12}
      zIndex={10}
      width={40}
      height={40}
      alignItems="center"
      justifyContent="center"
      borderRadius={radius.pill}
      backgroundColor={ui.surface}
      cursor="pointer"
      aria-label="Close"
      accessibilityLabel="Close"
      accessibilityRole="button"
      hitSlop={8}
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
      pressStyle={{ opacity: 0.75, scale: 0.96 }}
      onPress={() => sheet.setOpen(false)}
    >
      <Icons.X size={22} color={ui.text} />
    </XStack>
  )
}

/**
 * Tamagui Adapt → full-screen Sheet for Select / Popover / Menu on web, iOS,
 * and Android. Sized to the measured device screen, with a close button.
 */
export function NativeFullscreenAdapt({ children }: { children?: ReactNode }) {
  const overlayInsets = useFullscreenOverlayInsets()
  const screen = useFullscreenOverlaySize()

  return (
    <Adapt when>
      <Sheet
        modal
        dismissOnSnapToBottom
        snapPoints={[100]}
        snapPointsMode="percent"
        zIndex={200_000}
        animation="quick"
      >
        <SheetOverlay />
        <SheetFrame
          flex={1}
          height={screen.height}
          maxHeight={screen.height}
          minHeight={screen.height}
          width={screen.width}
          maxWidth={screen.width}
          minWidth={screen.width}
          borderRadius={0}
          padding={0}
          paddingTop={overlayInsets.top}
          // Adapted content is bottom-anchored — keep it off the nav bar.
          paddingBottom={overlayInsets.bottom}
          margin={0}
          backgroundColor="$background"
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
        >
          <SheetHandle />
          <AdaptSheetClose topInset={overlayInsets.top} />
          {children ?? <Adapt.Contents />}
        </SheetFrame>
      </Sheet>
    </Adapt>
  )
}
