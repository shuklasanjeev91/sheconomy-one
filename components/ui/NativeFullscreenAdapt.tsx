import type { ReactNode } from 'react'
import { Adapt } from 'tamagui'

import { Sheet, SheetFrame, SheetHandle, SheetOverlay } from '~/components/ui/Sheet'
import { isNativeFullscreenOverlay } from '~/lib/platform/native-fullscreen'

/**
 * Tamagui Adapt → full-screen Sheet for Select / Popover / Menu on iOS & Android.
 * Render as a sibling of the Content inside the parent compound component.
 * No-ops on web so desktop keeps anchored dropdowns.
 */
export function NativeFullscreenAdapt({ children }: { children?: ReactNode }) {
  if (!isNativeFullscreenOverlay) {
    return children ? <>{children}</> : null
  }

  return (
    <Adapt platform="touch">
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
          height="100%"
          maxHeight="100%"
          width="100%"
          borderRadius={0}
          padding="$0"
          backgroundColor="$background"
        >
          <SheetHandle />
          {children ?? <Adapt.Contents />}
        </SheetFrame>
      </Sheet>
    </Adapt>
  )
}
