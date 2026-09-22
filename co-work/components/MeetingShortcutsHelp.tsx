import { Modal, Platform, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button, Text, XStack, YStack } from '~/components/ui'
import { MEETING_KEYBOARD_SHORTCUTS } from '~/co-work/lib/meeting-keyboard-shortcuts'
import { MEETING_PORTAL_Z_INDEX } from '~/co-work/lib/meeting-toolbar'
import { meetingBarStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { coworkBoxShadow } from '~/lib/platform/crossStyles'
import { ViewportOverlay } from '~/components/layout'

type MeetingShortcutsHelpProps = {
  open: boolean
  onClose: () => void
}

/** Zoom-style keyboard shortcuts cheat sheet (web). */
export function MeetingShortcutsHelp({ open, onClose }: MeetingShortcutsHelpProps) {
  const { ui: coworkUi, shadows: coworkShadows } = useCoWorkTheme()
  const insets = useSafeAreaInsets()
  if (!open) return null

  const body = (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={18}
      borderWidth={1}
      borderColor={coworkUi.glassBorder}
      width="100%"
      maxWidth={420}
      style={{
        ...meetingBarStyle(coworkUi, true),
        ...coworkBoxShadow(coworkShadows, 'dock'),
      }}
    >
      <Text fontSize={17} fontWeight="800" color={coworkUi.text}>
        Keyboard shortcuts
      </Text>
      <YStack gap="$2">
        {MEETING_KEYBOARD_SHORTCUTS.map((row) => (
          <XStack key={row.action} alignItems="center" justifyContent="space-between" gap="$3">
            <Text fontSize={13} color={coworkUi.textSecondary} flex={1}>
              {row.label}
            </Text>
            <Text
              fontSize={12}
              fontWeight="700"
              color={coworkUi.text}
              paddingHorizontal="$2"
              paddingVertical={4}
              borderRadius={8}
              backgroundColor="rgba(255,255,255,0.08)"
            >
              {row.keys}
            </Text>
          </XStack>
        ))}
      </YStack>
      <Button tone="outline" borderRadius={999} onPress={onClose}>
        Close
      </Button>
    </YStack>
  )

  if (Platform.OS === 'web') {
    return (
      <ViewportOverlay>
        <YStack
          position={'fixed' as never}
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={MEETING_PORTAL_Z_INDEX}
          alignItems="center"
          justifyContent="center"
          padding="$4"
          backgroundColor="rgba(0,0,0,0.55)"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close shortcuts"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={onClose}
          />
          {body}
        </YStack>
      </ViewportOverlay>
    )
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 16,
        }}
        onPress={onClose}
      >
        <YStack onStartShouldSetResponder={() => true}>{body}</YStack>
      </Pressable>
    </Modal>
  )
}
