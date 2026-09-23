import type { ReactNode } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Theme } from 'tamagui'

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
 * Mobile + tablet: Zoom-mobile bottom sheet over the stage (matching Image 1 half-sheet).
 * Laptop+: Zoom-web right side dock above the toolbar (stage reflows).
 *
 * Sheets always render under Tamagui `dark` so composers/icons stay visible
 * even when the rest of the app is in light mode.
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
  const insets = useSafeAreaInsets()
  const keyboardInset = useComposerKeyboardInset()

  if (!open) return null

  if (presentation === 'bottom-sheet' && Platform.OS !== 'web') {
    return (
      <Theme name="dark">
        <View
          collapsable={false}
          pointerEvents="box-none"
          style={nativeSheetStyles.backdrop}
        >
          {/* Dimmed top backdrop: tapping dismisses the sheet while video stays visible on top (Image 1) */}
          <Pressable
            style={nativeSheetStyles.scrim}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close panel"
          />
          {/* Zoom mobile bottom half-sheet (Image 1) */}
          <View
            style={[
              nativeSheetStyles.halfSheet,
              {
                backgroundColor: coworkUi.surface,
                borderColor: coworkUi.glassBorder,
                paddingBottom: keyboardInset > 0 ? keyboardInset : Math.max(insets.bottom, 8),
              },
            ]}
          >
            <View style={nativeSheetStyles.body} collapsable={false} pointerEvents="auto">
              {children}
            </View>
          </View>
        </View>
      </Theme>
    )
  }

  if (presentation === 'bottom-sheet') {
    return (
      <Theme name="dark">
        <Sheet
          open={open}
          onOpenChange={(next) => {
            if (!next) onClose()
          }}
          modal
          dismissOnSnapToBottom={false}
          dismissOnOverlayPress={false}
          disableDrag
          snapPoints={[62]}
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
            borderTopLeftRadius={20}
            borderTopRightRadius={20}
            borderBottomLeftRadius={0}
            borderBottomRightRadius={0}
            overflow="hidden"
            height="62%"
            maxHeight="75%"
            width="100%"
            maxWidth="100%"
          >
            <SheetHandle backgroundColor={coworkUi.borderSoft} marginTop="$2" />
            <YStack flex={1} minHeight={0} width="100%" overflow="hidden">
              {children}
            </YStack>
          </SheetFrame>
        </Sheet>
      </Theme>
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
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: NATIVE_SHEET_Z,
    justifyContent: 'flex-end',
  },
  scrim: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  halfSheet: {
    width: '100%',
    height: '62%',
    maxHeight: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    elevation: 48,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
  },
  body: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    overflow: 'hidden',
  },
})
