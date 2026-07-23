import type { ReactNode } from 'react'

import { Adapt } from 'tamagui'

import { Sheet, SheetFrame, SheetHandle, SheetOverlay } from '~/components/ui/Sheet'

/**
 * Tamagui Adapt → full-screen Sheet for Select / Popover / Menu on web, iOS,
 * and Android. No bottom gap — frame covers the entire viewport.
 */
export function NativeFullscreenAdapt({ children }: { children?: ReactNode }) {
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
          height="100%"
          maxHeight="100%"
          minHeight="100%"
          width="100%"
          borderRadius={0}
          padding={0}
          margin={0}
          backgroundColor="$background"
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
        >
          <SheetHandle />
          {children ?? <Adapt.Contents />}
        </SheetFrame>
      </Sheet>
    </Adapt>
  )
}
