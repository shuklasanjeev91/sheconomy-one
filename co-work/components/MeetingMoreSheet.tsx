import { useWindowDimensions } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { AppBottomSheet, Icons, Text, XStack, YStack } from '~/components/ui'
import {
  meetingMobileMoreGridKeys,
  meetingMobileMoreGridLabel,
} from '~/co-work/lib/meeting-mobile-more'
import type { MeetingToolbarOverflowKey } from '~/co-work/lib/meeting-toolbar'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { MeetingRole } from '~/co-work/lib/types'

type GridAction = {
  key: MeetingToolbarOverflowKey
  label: string
  icon: typeof Icons.Users
  onPress: (() => void) | null
  badgeCount?: number
  disabled?: boolean
  active?: boolean
}

export type MeetingMoreSheetProps = {
  open: boolean
  onClose: () => void
  viewerRole: MeetingRole
  handRaised: boolean
  participantCount?: number
  supportsScreenShare?: boolean
  supportsLiveCaptions?: boolean
  hasWhiteboard?: boolean
  hasHostTools?: boolean
  supportsRecording?: boolean
  recording?: boolean
  screenSharing?: boolean
  captionsActive?: boolean
  hasBackground?: boolean
  backgroundActive?: boolean
  onToggleHand: () => void
  onOpenReactions: () => void
  onSendQuickReaction?: (emoji: string) => void
  resolveAction: (key: MeetingToolbarOverflowKey) => (() => void) | null
}

const QUICK_REACTIONS = ['🎉', '👍', '❤️'] as const

/**
 * Meeting More — always shows every Zoom More grid option
 * (Participants · Start share · Show captions · Apps · Disconnect audio ·
 * Meeting info · Host tools · Settings) plus raise hand / quick reactions.
 */
export function MeetingMoreSheet({
  open,
  onClose,
  viewerRole,
  handRaised,
  participantCount = 0,
  supportsScreenShare = true,
  supportsLiveCaptions = true,
  hasWhiteboard = true,
  hasHostTools,
  supportsRecording = false,
  recording = false,
  screenSharing = false,
  captionsActive = false,
  hasBackground = true,
  backgroundActive = false,
  onToggleHand,
  onOpenReactions,
  onSendQuickReaction,
  resolveAction,
}: MeetingMoreSheetProps) {
  const { ui } = useCoWorkTheme()
  const { height } = useWindowDimensions()

  if (!open) return null

  const gridKeys = meetingMobileMoreGridKeys({
    viewerRole,
    supportsScreenShare,
    supportsLiveCaptions,
    hasWhiteboard,
    hasHostTools,
    hasBackground,
    supportsRecording,
    hasSafeDriving: true,
  })

  const iconFor = (key: MeetingToolbarOverflowKey): typeof Icons.Users => {
    switch (key) {
      case 'manage_participants':
        return Icons.Users
      case 'share_screen':
        return Icons.ScreenShare
      case 'captions':
        return Icons.Captions
      case 'whiteboard':
        return Icons.PenTool
      case 'background':
        return Icons.Sparkles
      case 'record':
        return Icons.Circle
      case 'polls':
        return Icons.Scan
      case 'disconnect_audio':
        return Icons.HeadphoneOff
      case 'meeting_info':
        return Icons.Info
      case 'host_tools':
        return Icons.ShieldCheck
      case 'settings':
        return Icons.Settings
      case 'safe_driving':
        return Icons.Car
      default:
        return Icons.MoreHorizontal
    }
  }

  const labelFor = (key: MeetingToolbarOverflowKey): string => {
    if (key === 'share_screen') return screenSharing ? 'Stop share' : 'Start share'
    if (key === 'captions') return captionsActive ? 'Hide captions' : 'Show captions'
    if (key === 'record') return recording ? 'Stop recording' : 'Record'
    if (key === 'background') return backgroundActive ? 'Background on' : 'Background'
    return meetingMobileMoreGridLabel(key)
  }

  // Always render every grid key — never drop rows when a handler is missing.
  const actions: GridAction[] = gridKeys.map((key) => {
    const onPress = resolveAction(key)
    const active =
      (key === 'record' && recording) || (key === 'background' && backgroundActive)
    return {
      key,
      label: labelFor(key),
      icon: iconFor(key),
      onPress,
      disabled: !onPress,
      badgeCount: key === 'manage_participants' && participantCount > 0 ? participantCount : undefined,
      active,
    }
  })

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      showHandle
      hideHeader
      fitContent
      scrollable={false}
      surfaceColor={ui.meetingBarElevated}
      handleColor={ui.borderSoft}
    >
      <YStack gap="$4" maxHeight={Math.round(height * 0.72)} width="100%">
        <XStack alignItems="center" justifyContent="space-between" gap="$2">
          <Pressable
            onPress={() => {
              onToggleHand()
            }}
            accessibilityRole="button"
            accessibilityLabel={handRaised ? 'Lower hand' : 'Raise hand'}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: handRaised ? ui.brandMuted : ui.meetingControl,
              borderWidth: 1,
              borderColor: handRaised ? ui.brand : ui.borderSoft,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text fontSize={18}>✋</Text>
            <Text color={handRaised ? ui.brandLight : ui.text} fontSize={14} fontWeight="600">
              {handRaised ? 'Lower hand' : 'Raise hand'}
            </Text>
          </Pressable>

          <XStack alignItems="center" gap={4} flexShrink={0}>
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => onSendQuickReaction?.(emoji)}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 999,
                  backgroundColor: pressed ? ui.brandMuted : 'transparent',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text fontSize={24}>{emoji}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                onClose()
                onOpenReactions()
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="More reactions"
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                backgroundColor: pressed ? ui.brandMuted : ui.meetingControl,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icons.MoreHorizontal size={22} color={ui.textSecondary} strokeWidth={2} />
            </Pressable>
          </XStack>
        </XStack>

        <XStack flexWrap="wrap" width="100%">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Pressable
                key={action.key}
                disabled={action.disabled}
                onPress={() => {
                  if (!action.onPress) return
                  onClose()
                  action.onPress()
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={{ disabled: !!action.disabled }}
                style={({ pressed }) => ({
                  width: '33.33%',
                  alignItems: 'center',
                  paddingVertical: 16,
                  gap: 10,
                  opacity: action.disabled ? 0.35 : pressed ? 0.7 : 1,
                })}
              >
                <YStack position="relative" alignItems="center" justifyContent="center" height={36}>
                  <Icon
                    size={26}
                    color={action.active ? ui.brandLight : ui.text}
                    strokeWidth={1.6}
                  />
                  {action.badgeCount ? (
                    <YStack
                      position="absolute"
                      top={-4}
                      right={-14}
                      minWidth={16}
                      height={16}
                      paddingHorizontal={3}
                      borderRadius={999}
                      backgroundColor={ui.brand}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text color="#fff" fontSize={10} fontWeight="800">
                        {action.badgeCount > 99 ? '99+' : action.badgeCount}
                      </Text>
                    </YStack>
                  ) : null}
                </YStack>
                <Text
                  color={ui.textSecondary}
                  fontSize={12}
                  fontWeight="500"
                  textAlign="center"
                  numberOfLines={2}
                >
                  {action.label}
                </Text>
              </Pressable>
            )
          })}
        </XStack>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 48,
            borderRadius: 999,
            backgroundColor: ui.meetingControl,
            borderWidth: 1,
            borderColor: ui.borderSoft,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Icons.X size={18} color={ui.text} strokeWidth={2} />
          <Text color={ui.text} fontSize={15} fontWeight="700">
            Close
          </Text>
        </Pressable>
      </YStack>
    </AppBottomSheet>
  )
}

export { MeetingMoreSheet as MeetingMobileMoreSheet }
