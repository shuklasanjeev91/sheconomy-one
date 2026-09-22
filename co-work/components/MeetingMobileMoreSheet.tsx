import { Modal, Pressable, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
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
  onPress: () => void
  badgeCount?: number
  active?: boolean
}

type MeetingMobileMoreSheetProps = {
  open: boolean
  onClose: () => void
  viewerRole: MeetingRole
  handRaised: boolean
  participantCount?: number
  supportsScreenShare?: boolean
  supportsLiveCaptions?: boolean
  hasWhiteboard?: boolean
  hasHostTools?: boolean
  onToggleHand: () => void
  onOpenReactions: () => void
  onSendQuickReaction?: (emoji: string) => void
  resolveAction: (key: MeetingToolbarOverflowKey) => (() => void) | null
}

const QUICK_REACTIONS = ['🎉', '👍', '❤️'] as const

/**
 * Zoom-mobile More bottom sheet: raise-hand + reactions strip, then icon grid.
 * Sheconomy magenta accents on a dark rose chrome sheet.
 */
export function MeetingMobileMoreSheet({
  open,
  onClose,
  viewerRole,
  handRaised,
  participantCount = 0,
  supportsScreenShare = true,
  supportsLiveCaptions = true,
  hasWhiteboard = true,
  hasHostTools,
  onToggleHand,
  onOpenReactions,
  onSendQuickReaction,
  resolveAction,
}: MeetingMobileMoreSheetProps) {
  const { ui } = useCoWorkTheme()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()

  if (!open) return null

  const gridKeys = meetingMobileMoreGridKeys({
    viewerRole,
    supportsScreenShare,
    supportsLiveCaptions,
    hasWhiteboard,
    hasHostTools,
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
      case 'polls':
        return Icons.LayoutGrid
      case 'disconnect_audio':
        return Icons.Headphones
      case 'meeting_info':
        return Icons.Info
      case 'host_tools':
        return Icons.Shield
      case 'settings':
        return Icons.Settings
      case 'safe_driving':
        return Icons.Car
      default:
        return Icons.MoreHorizontal
    }
  }

  const actions: GridAction[] = gridKeys
    .map((key) => {
      const onPress = resolveAction(key)
      if (!onPress) return null
      return {
        key,
        label: meetingMobileMoreGridLabel(key),
        icon: iconFor(key),
        onPress: () => {
          onClose()
          onPress()
        },
        badgeCount: key === 'manage_participants' && participantCount > 0 ? participantCount : undefined,
      }
    })
    .filter(Boolean) as GridAction[]

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <YStack
            backgroundColor="#1A0F16"
            borderTopLeftRadius={18}
            borderTopRightRadius={18}
            borderWidth={1}
            borderColor="rgba(255,255,255,0.1)"
            maxHeight={Math.round(height * 0.72)}
            paddingBottom={Math.max(insets.bottom, 12)}
          >
            <YStack alignItems="center" paddingTop="$2" paddingBottom="$1">
              <YStack width={36} height={4} borderRadius={999} backgroundColor="rgba(255,255,255,0.28)" />
            </YStack>

            <XStack
              alignItems="center"
              gap="$2"
              paddingHorizontal="$4"
              paddingVertical="$3"
              borderBottomWidth={1}
              borderBottomColor="rgba(255,255,255,0.08)"
            >
              <Pressable
                onPress={() => {
                  onToggleHand()
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: handRaised ? 'rgba(216,27,96,0.28)' : 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: handRaised ? ui.brandLight : 'rgba(255,255,255,0.14)',
                }}
              >
                <Text fontSize={16}>✋</Text>
                <Text color="#fff" fontSize={13} fontWeight="800">
                  {handRaised ? 'Lower hand' : 'Raise hand'}
                </Text>
              </Pressable>
              {QUICK_REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    onSendQuickReaction?.(emoji)
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Text fontSize={18}>{emoji}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  onClose()
                  onOpenReactions()
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Icons.MoreHorizontal size={18} color="#fff" />
              </Pressable>
            </XStack>

            <ScrollView
              paddingHorizontal="$3"
              paddingTop="$3"
              showsVerticalScrollIndicator={false}
            >
              <XStack flexWrap="wrap">
                {actions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Pressable
                      key={action.key}
                      onPress={action.onPress}
                      style={{
                        width: '33.33%',
                        alignItems: 'center',
                        paddingVertical: 14,
                        gap: 8,
                      }}
                    >
                      <YStack position="relative" alignItems="center" justifyContent="center">
                        <YStack
                          width={48}
                          height={48}
                          borderRadius={14}
                          alignItems="center"
                          justifyContent="center"
                          backgroundColor="rgba(255,255,255,0.08)"
                        >
                          <Icon size={22} color="#fff" />
                        </YStack>
                        {action.badgeCount ? (
                          <YStack
                            position="absolute"
                            top={-4}
                            right={-6}
                            minWidth={18}
                            height={18}
                            paddingHorizontal={4}
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
                      <Text color="#E8D4DE" fontSize={11} fontWeight="700" textAlign="center">
                        {action.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </XStack>
            </ScrollView>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
