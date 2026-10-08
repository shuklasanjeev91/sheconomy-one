import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { AppBottomSheet, Text, XStack, YStack } from '~/components/ui'
import { ReactionStickerImage } from '~/components/emoji/ReactionStickerImage'
import { MEETING_REACTIONS } from '~/co-work/lib/meeting-reactions'
import {
  MEETING_NONVERBAL_STATUSES,
  type MeetingNonverbalStatusId,
} from '~/co-work/lib/meeting-nonverbal'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { REACTION_STICKERS } from '~/lib/emoji/reaction-stickers'

type MeetingReactionTrayProps = {
  open: boolean
  onSelect: (emoji: string) => void
  onSelectNonverbal?: (status: MeetingNonverbalStatusId | null) => void
  activeNonverbal?: MeetingNonverbalStatusId | null
  handRaised?: boolean
  onToggleHand?: () => void
  onRequestClose?: () => void
}

/** Zoom-style “Send with effect” — same emoji, presented as effect chips. */
const SEND_WITH_EFFECT = ['🎈', '🚀', '👍', '🎉', '😂', '❤️'] as const

/** Reactions + raise hand as a Zoom-mobile bottom sheet. */
export function MeetingReactionTray({
  open,
  onSelect,
  onSelectNonverbal,
  activeNonverbal = null,
  handRaised = false,
  onToggleHand,
  onRequestClose,
}: MeetingReactionTrayProps) {
  const { ui } = useCoWorkTheme()

  const selectAndClose = (emoji: string) => {
    onRequestClose?.()
    onSelect(emoji)
  }

  const selectNonverbal = (status: MeetingNonverbalStatusId | null) => {
    onSelectNonverbal?.(status)
    onRequestClose?.()
  }

  const toggleHandAndClose = () => {
    onToggleHand?.()
    onRequestClose?.()
  }

  const primaryReactions = MEETING_REACTIONS.slice(0, 6)

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onRequestClose?.()
      }}
      title="Reactions"
      showHandle
      scrollable
      fitContent
      surfaceColor={ui.meetingBarElevated}
      handleColor={ui.borderSoft}
    >
      <YStack gap="$4" paddingBottom="$3">
        {onToggleHand ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={handRaised ? 'Lower hand' : 'Raise hand'}
            onPress={toggleHandAndClose}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              minHeight: 48,
              borderRadius: 12,
              backgroundColor: handRaised ? ui.brandMuted : ui.surfaceMuted,
              borderWidth: 1,
              borderColor: handRaised ? ui.brand : ui.borderSoft,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text fontSize={20}>✋</Text>
            <Text fontSize={16} fontWeight="700" color={ui.text}>
              {handRaised ? 'Lower hand' : 'Raise hand'}
            </Text>
          </Pressable>
        ) : null}

        {onSelectNonverbal ? (
          <XStack alignItems="center" justifyContent="space-between" paddingHorizontal="$1">
            {MEETING_NONVERBAL_STATUSES.filter((row) =>
              ['yes', 'no', 'slow', 'faster', 'break'].includes(row.id),
            ).map((row) => {
              const active = activeNonverbal === row.id
              return (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                  onPress={() => selectNonverbal(active ? null : row.id)}
                  style={({ pressed }) => ({
                    width: 52,
                    height: 52,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? ui.brandMuted : ui.surfaceMuted,
                    borderWidth: 1,
                    borderColor: active ? ui.brand : ui.borderSoft,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text fontSize={22}>{row.emoji}</Text>
                </Pressable>
              )
            })}
          </XStack>
        ) : null}

        <YStack gap="$2">
          <Text fontSize={13} fontWeight="700" color={ui.textMuted}>
            Reactions
          </Text>
          <XStack alignItems="center" justifyContent="space-between">
            {primaryReactions.map((item) => (
              <Pressable
                key={item.emoji}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => selectAndClose(item.emoji)}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text fontSize={26}>{item.emoji}</Text>
              </Pressable>
            ))}
          </XStack>
        </YStack>

        <YStack gap="$2">
          <Text fontSize={13} fontWeight="700" color={ui.textMuted}>
            Send with effect
          </Text>
          <XStack alignItems="center" justifyContent="space-between">
            {SEND_WITH_EFFECT.map((emoji) => (
              <Pressable
                key={`effect-${emoji}`}
                accessibilityRole="button"
                accessibilityLabel={`Send ${emoji} with effect`}
                onPress={() => selectAndClose(emoji)}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: ui.surfaceMuted,
                  borderWidth: 1,
                  borderColor: ui.borderSoft,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text fontSize={24}>{emoji}</Text>
              </Pressable>
            ))}
          </XStack>
        </YStack>

        <YStack gap="$2">
          <Text fontSize={13} fontWeight="700" color={ui.textMuted}>
            Stickers
          </Text>
          <XStack alignItems="center" justifyContent="space-between" flexWrap="wrap" rowGap={8}>
            {REACTION_STICKERS.map((sticker) => (
              <Pressable
                key={sticker.value}
                accessibilityRole="button"
                accessibilityLabel={sticker.label}
                onPress={() => selectAndClose(sticker.value)}
                style={({ pressed }) => ({
                  width: '16%',
                  minWidth: 48,
                  height: 48,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: ui.surfaceMuted,
                  borderWidth: 1,
                  borderColor: ui.borderSoft,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <ReactionStickerImage value={sticker.value} sticker={sticker} size={38} />
              </Pressable>
            ))}
          </XStack>
        </YStack>
      </YStack>
    </AppBottomSheet>
  )
}
