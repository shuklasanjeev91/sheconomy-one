import { Modal, Platform, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button, Text, XStack, YStack } from '~/components/ui'
import { MEETING_REACTIONS } from '~/co-work/lib/meeting-reactions'
import {
  MEETING_PORTAL_Z_INDEX,
  MEETING_REACTION_TRAY_Z_INDEX,
} from '~/co-work/lib/meeting-toolbar'
import { meetingBarStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { coworkBoxShadow } from '~/lib/platform/crossStyles'
import { ViewportOverlay } from '~/components/layout'

type MeetingReactionTrayProps = {
  open: boolean
  onSelect: (emoji: string) => void
  onRequestClose?: () => void
}

function ReactionChipRow({
  onSelect,
}: {
  onSelect: (emoji: string) => void
}) {
  const { ui: coworkUi, shadows: coworkShadows } = useCoWorkTheme()

  return (
    <XStack
      alignItems="center"
      gap="$1"
      paddingHorizontal="$2.5"
      paddingVertical="$2"
      borderRadius={999}
      borderWidth={1}
      borderColor={coworkUi.glassBorder}
      style={{
        ...meetingBarStyle(coworkUi, true),
        ...coworkBoxShadow(coworkShadows, 'dock'),
      }}
    >
      {MEETING_REACTIONS.map((item) => (
        <Button
          key={item.emoji}
          aria-label={item.label}
          chromeless
          circular
          width={44}
          height={44}
          padding={0}
          pressStyle={{ scale: 1.15 }}
          hoverStyle={{ scale: 1.08, backgroundColor: 'rgba(255,255,255,0.08)' }}
          onPress={() => onSelect(item.emoji)}
        >
          <Text fontSize={24}>{item.emoji}</Text>
        </Button>
      ))}
    </XStack>
  )
}

/** Quick-reaction strip above the meeting control dock — escapes host overflow on all platforms. */
export function MeetingReactionTray({ open, onSelect, onRequestClose }: MeetingReactionTrayProps) {
  const insets = useSafeAreaInsets()
  if (!open) return null

  const selectAndClose = (emoji: string) => {
    onSelect(emoji)
    onRequestClose?.()
  }

  if (Platform.OS === 'web') {
    return (
      <ViewportOverlay>
        <YStack
          position={'fixed' as never}
          left={0}
          right={0}
          bottom={Math.max(insets.bottom, 12) + 88}
          alignItems="center"
          zIndex={MEETING_PORTAL_Z_INDEX}
          pointerEvents="box-none"
          style={{ position: 'fixed', zIndex: MEETING_PORTAL_Z_INDEX }}
        >
          <ReactionChipRow onSelect={selectAndClose} />
        </YStack>
      </ViewportOverlay>
    )
  }

  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={onRequestClose}>
      <YStack flex={1} width="100%" height="100%">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close reactions"
          onPress={onRequestClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(12, 8, 10, 0.25)',
          }}
        />
        <YStack
          flex={1}
          justifyContent="flex-end"
          alignItems="center"
          paddingBottom={Math.max(insets.bottom, 12) + 88}
          pointerEvents="box-none"
          zIndex={MEETING_REACTION_TRAY_Z_INDEX}
        >
          <ReactionChipRow onSelect={selectAndClose} />
        </YStack>
      </YStack>
    </Modal>
  )
}
