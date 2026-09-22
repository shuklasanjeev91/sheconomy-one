import type { ReactNode } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Theme, useThemeName } from 'tamagui'

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
import { useComposerKeyboardInset } from '~/hooks/useKeyboardVisible'

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

const NATIVE_SHEET_Z = 200_000

/**
 * Host for Chat / Participants / Invite / etc.
 * Mobile + tablet: Zoom-mobile bottom sheet over the stage.
 * Laptop+: Zoom-web right side dock above the toolbar (stage reflows).
 *
 * Native sheets stay in-tree (no Tamagui Sheet, no RN Modal). Video SurfaceViews
 * are unmounted while the sheet is open so they cannot steal taps. Interactive
 * chrome in the sheet uses RN Pressable.
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
  const themeName = useThemeName()
  const insets = useSafeAreaInsets()
  const keyboardInset = useComposerKeyboardInset()

  if (!open) return null

  if (presentation === 'bottom-sheet' && Platform.OS !== 'web') {
    return (
      <Theme name={themeName}>
        <View
          collapsable={false}
          pointerEvents="auto"
          style={[
            nativeSheetStyles.fill,
            {
              backgroundColor: coworkUi.surface,
              paddingTop: Math.max(insets.top, 8),
              // iOS keyboard overlays the window; lift the whole sheet so the
              // composer / search field stays visible. Android resizes instead.
              paddingBottom: keyboardInset > 0 ? keyboardInset : Math.max(insets.bottom, 8),
            },
          ]}
        >
          <View style={nativeSheetStyles.handleWrap} pointerEvents="none">
            <View style={[nativeSheetStyles.handle, { backgroundColor: coworkUi.borderSoft }]} />
          </View>
          <View style={nativeSheetStyles.body} collapsable={false} pointerEvents="auto">
            {children}
          </View>
        </View>
      </Theme>
    )
  }

  if (presentation === 'bottom-sheet') {
    return (
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        modal
        dismissOnSnapToBottom={false}
        dismissOnOverlayPress={false}
        disableDrag
        snapPoints={[96]}
        snapPointsMode="percent"
        zIndex={MEETING_SIDE_PANEL_Z_INDEX + 40}
        animation="quick"
        moveOnKeyboardChange={false}
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
          height="96%"
          maxHeight="96%"
          width="100%"
          maxWidth="100%"
        >
          <SheetHandle backgroundColor={coworkUi.borderSoft} marginTop="$2" />
          <YStack flex={1} minHeight={0} width="100%" overflow="hidden">
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
      maxHeight={Platform.OS === 'web' ? (`calc(100vh - ${top + bottom}px)` as any) : undefined}
      minHeight={0}
      overflow="hidden"
    >
      {children}
    </YStack>
  )
}

const nativeSheetStyles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: NATIVE_SHEET_Z,
    elevation: 48,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 999,
  },
  body: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    overflow: 'hidden',
  },
})
