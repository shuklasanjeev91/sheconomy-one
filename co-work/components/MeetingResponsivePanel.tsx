import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import {
  Sheet,
  SheetFrame,
  SheetHandle,
  SheetOverlay,
  YStack,
} from '~/components/ui'
import { MEETING_SIDE_PANEL_Z_INDEX } from '~/co-work/lib/meeting-toolbar'
import type { MeetingPanelPresentation } from '~/co-work/lib/meeting-responsive'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingResponsivePanelProps = {
  open: boolean
  onClose: () => void
  presentation: MeetingPanelPresentation
  /** Side-dock geometry (ignored for bottom sheets). */
  top?: number
  bottom?: number
  trailingInset?: number
  width?: number
  /** Overlay position strategy from the room screen. */
  overlayPosition?: 'absolute' | 'fixed'
  children: ReactNode
}

/**
 * Host for Chat / Participants / Invite / etc.
 * Mobile (+ tablet portrait): bottom sheet over the stage.
 * Laptop / desktop / large desktop: right side dock above the toolbar.
 */
export function MeetingResponsivePanel({
  open,
  onClose,
  presentation,
  top = 0,
  bottom = 0,
  trailingInset = 12,
  width = 360,
  overlayPosition = Platform.OS === 'web' ? 'fixed' : 'absolute',
  children,
}: MeetingResponsivePanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()

  if (!open) return null

  if (presentation === 'bottom-sheet') {
    return (
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        modal
        dismissOnSnapToBottom
        snapPoints={[88]}
        snapPointsMode="percent"
        zIndex={MEETING_SIDE_PANEL_Z_INDEX + 40}
        animation="quick"
        moveOnKeyboardChange={Platform.OS !== 'web'}
      >
        <SheetOverlay animation="quick" />
        <SheetFrame
          padding={0}
          margin={0}
          backgroundColor={coworkUi.surface}
          borderTopLeftRadius={18}
          borderTopRightRadius={18}
          borderBottomLeftRadius={0}
          borderBottomRightRadius={0}
          overflow="hidden"
          height="88%"
          maxHeight="88%"
          width="100%"
          maxWidth="100%"
        >
          <SheetHandle backgroundColor={coworkUi.borderSoft} marginTop="$2" />
          <YStack flex={1} minHeight={0} width="100%">
            {children}
          </YStack>
        </SheetFrame>
      </Sheet>
    )
  }

  return (
    <YStack
      position={overlayPosition}
      top={top}
      right={trailingInset}
      width={width}
      bottom={bottom}
      zIndex={MEETING_SIDE_PANEL_Z_INDEX}
      pointerEvents="auto"
    >
      {children}
    </YStack>
  )
}
