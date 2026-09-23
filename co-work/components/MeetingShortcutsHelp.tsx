import { AppBottomSheet, Text, XStack, YStack } from '~/components/ui'
import { MEETING_KEYBOARD_SHORTCUTS } from '~/co-work/lib/meeting-keyboard-shortcuts'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingShortcutsHelpProps = {
  open: boolean
  onClose: () => void
}

/** Keyboard shortcuts cheat sheet as a bottom sheet. */
export function MeetingShortcutsHelp({ open, onClose }: MeetingShortcutsHelpProps) {
  const { ui } = useCoWorkTheme()

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Keyboard shortcuts"
      showHandle
      scrollable
    >
      <YStack gap="$2" paddingBottom="$2">
        {MEETING_KEYBOARD_SHORTCUTS.map((row) => (
          <XStack key={row.action} alignItems="center" justifyContent="space-between" gap="$3">
            <Text fontSize={14} color={ui.textSecondary} flex={1}>
              {row.label}
            </Text>
            <Text
              fontSize={12}
              fontWeight="700"
              color={ui.text}
              paddingHorizontal="$2"
              paddingVertical={6}
              borderRadius={8}
              backgroundColor={ui.surfaceMuted}
            >
              {row.keys}
            </Text>
          </XStack>
        ))}
      </YStack>
    </AppBottomSheet>
  )
}
