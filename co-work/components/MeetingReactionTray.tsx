import { useEffect, useState } from 'react'
import { Modal, Platform, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button, Text, XStack, YStack } from '~/components/ui'
import { applyMeetingReactionTone, MEETING_REACTIONS } from '~/co-work/lib/meeting-reactions'
import {
  MEETING_NONVERBAL_STATUSES,
  type MeetingNonverbalStatusId,
} from '~/co-work/lib/meeting-nonverbal'
import {
  loadMeetingMediaPrefs,
  MEETING_REACTION_TONES,
  saveMeetingMediaPrefs,
} from '~/co-work/lib/meeting-media-prefs'
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
  onSelectNonverbal?: (status: MeetingNonverbalStatusId | null) => void
  activeNonverbal?: MeetingNonverbalStatusId | null
  onRequestClose?: () => void
}

function ReactionChipRow({
  tone,
  onSelect,
  onToneChange,
  onSelectNonverbal,
  activeNonverbal,
}: {
  tone: string
  onSelect: (emoji: string) => void
  onToneChange: (tone: string) => void
  onSelectNonverbal?: (status: MeetingNonverbalStatusId | null) => void
  activeNonverbal?: MeetingNonverbalStatusId | null
}) {
  const { ui: coworkUi, shadows: coworkShadows } = useCoWorkTheme()

  return (
    <YStack
      gap="$1.5"
      paddingHorizontal="$2.5"
      paddingVertical="$2"
      borderRadius={18}
      borderWidth={1}
      borderColor={coworkUi.glassBorder}
      style={{
        ...meetingBarStyle(coworkUi, true),
        ...coworkBoxShadow(coworkShadows, 'dock'),
      }}
    >
      <XStack alignItems="center" gap="$1">
        {MEETING_REACTIONS.map((item) => {
          const emoji = applyMeetingReactionTone(item.emoji, tone)
          return (
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
              onPress={() => onSelect(emoji)}
            >
              <Text fontSize={24}>{emoji}</Text>
            </Button>
          )
        })}
      </XStack>
      {onSelectNonverbal ? (
        <XStack alignItems="center" gap="$1" flexWrap="wrap" justifyContent="center">
          {MEETING_NONVERBAL_STATUSES.map((row) => (
            <Button
              key={row.id}
              aria-label={row.label}
              chromeless
              height={32}
              paddingHorizontal="$2"
              borderRadius={999}
              backgroundColor={
                activeNonverbal === row.id ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'
              }
              onPress={() =>
                onSelectNonverbal(activeNonverbal === row.id ? null : row.id)
              }
            >
              <Text fontSize={13}>
                {row.emoji} {row.label}
              </Text>
            </Button>
          ))}
        </XStack>
      ) : null}
      <XStack alignItems="center" justifyContent="center" gap="$1.5" paddingBottom="$0.5">
        {MEETING_REACTION_TONES.map((row) => (
          <Pressable
            key={row.id || 'default'}
            accessibilityLabel={row.label}
            onPress={() => onToneChange(row.id)}
            style={{
              width: 18,
              height: 18,
              borderRadius: 99,
              backgroundColor: row.swatch,
              borderWidth: tone === row.id ? 2 : 1,
              borderColor: tone === row.id ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
            }}
          />
        ))}
      </XStack>
    </YStack>
  )
}

/** Quick-reaction strip above the meeting control dock — escapes host overflow on all platforms. */
export function MeetingReactionTray({
  open,
  onSelect,
  onSelectNonverbal,
  activeNonverbal = null,
  onRequestClose,
}: MeetingReactionTrayProps) {
  const insets = useSafeAreaInsets()
  const [tone, setTone] = useState('')

  useEffect(() => {
    if (!open) return
    void loadMeetingMediaPrefs().then((prefs) => setTone(prefs.reactionTone ?? ''))
  }, [open])

  if (!open) return null

  const selectAndClose = (emoji: string) => {
    onRequestClose?.()
    onSelect(emoji)
  }

  const selectNonverbal = (status: MeetingNonverbalStatusId | null) => {
    onSelectNonverbal?.(status)
    onRequestClose?.()
  }

  const changeTone = (next: string) => {
    setTone(next)
    void loadMeetingMediaPrefs().then((prefs) =>
      saveMeetingMediaPrefs({ ...prefs, reactionTone: next }),
    )
  }

  if (Platform.OS === 'web') {
    return (
      <ViewportOverlay>
        <YStack
          position={'fixed' as never}
          top={0}
          left={0}
          right={0}
          bottom={0}
          pointerEvents="box-none"
          zIndex={MEETING_PORTAL_Z_INDEX}
          alignItems="center"
          justifyContent="flex-end"
          paddingBottom={Math.max(insets.bottom, 12) + 78}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close reactions"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={onRequestClose}
          />
          <ReactionChipRow
            tone={tone}
            onSelect={selectAndClose}
            onToneChange={changeTone}
            onSelectNonverbal={onSelectNonverbal ? selectNonverbal : undefined}
            activeNonverbal={activeNonverbal}
          />
        </YStack>
      </ViewportOverlay>
    )
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onRequestClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close reactions"
        style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}
        onPress={onRequestClose}
      >
        <YStack
          paddingBottom={Math.max(insets.bottom, 12) + 78}
          zIndex={MEETING_REACTION_TRAY_Z_INDEX}
          onStartShouldSetResponder={() => true}
        >
          <ReactionChipRow
            tone={tone}
            onSelect={selectAndClose}
            onToneChange={changeTone}
            onSelectNonverbal={onSelectNonverbal ? selectNonverbal : undefined}
            activeNonverbal={activeNonverbal}
          />
        </YStack>
      </Pressable>
    </Modal>
  )
}
