import { useState, type ReactNode } from 'react'
import { Platform, ScrollView as RNScrollView } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import {
  AppBottomSheet,
  Avatar,
  Button,
  Icons,
  Input,
  Popover,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { CoWorkPanelShell, CoWorkSectionLabel } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { MeetingSheetButton } from '~/co-work/components/MeetingSheetButton'
import { MeetingRoleBadge } from '~/co-work/components/MeetingRoleBadge'
import { useCoWorkTheme, useMeetingControlPalette } from '~/co-work/lib/theme'
import type { MeetingParticipant, MeetingRole } from '~/co-work/lib/types'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'
import {
  compareMeetingActivity,
  type MeetingActivitySignals,
} from '~/co-work/lib/meeting-participant-order'
import {
  canAdmitParticipants,
  canManageMeeting,
  meetingRoleFromFlags,
} from '~/co-work/lib/meeting-role-permissions'
import { hostBulkActions, participantRowActions } from '~/co-work/lib/meeting-participant-actions'

type MeetingParticipantsPanelProps = {
  participants: MeetingParticipant[]
  isHost: boolean
  viewerRole: MeetingRole
  currentUserId: string
  isLocked?: boolean
  /** Whether participants can unmute themselves (host can toggle this). */
  allowSelfUnmute?: boolean
  onAdmit: (participantId: string) => void
  onReject?: (participantId: string) => void
  onAdmitAll?: () => void
  onRemove?: (participantId: string) => void
  /** Send admitted participant back to waiting room. */
  onPutInWaitingRoom?: (participantId: string) => void
  onAllowRejoin?: (participantId: string) => void
  onForceMute?: (userId: string) => void
  onAskToUnmute?: (userId: string) => void
  onRequestMute?: (userId: string) => void
  /** Host lowers one raised hand. */
  onLowerHand?: (userId: string) => void
  onStopVideo?: (userId: string) => void
  /** Host asks a video-off participant to start their camera. */
  onAskToStartVideo?: (userId: string) => void
  /** Rename a participant (session-only display name). */
  onRename?: (userId: string, newName: string) => void
  onAssignCoHost?: (userId: string) => void
  onRemoveCoHost?: (userId: string) => void
  onTransferHost?: (userId: string) => void
  /** Opens SHEconomy joined-participant picker to transfer host. */
  onOpenTransferHost?: () => void
  onToggleLock?: () => void
  onMuteAll?: () => void
  onAskAllToUnmute?: () => void
  onAskAllToMute?: () => void
  /** Toggle whether locked-muted participants can self-unmute. */
  onToggleAllowSelfUnmute?: () => void
  onRemoveAllExceptHost?: () => void
  onClose: () => void
  onInvite?: () => void
  raisedHands?: Record<string, boolean>
  fullWidth?: boolean
  spotlightUserId?: string | null
  onSetSpotlight?: (userId: string | null) => void
  pinnedUserIds?: string[]
  onTogglePin?: (userId: string) => void
  /** Live SFU active speakers (identity === user_id), floated above everyone else. */
  speakingUserIds?: string[]
}

function participantActivitySignals(
  participant: MeetingParticipant,
  speakingSet: Set<string>,
): MeetingActivitySignals {
  return {
    id: participant.user_id,
    name: safeMeetingDisplayName(
      participant.display_name || participant.profile?.full_name || participant.profile?.username,
    ),
    speaking: speakingSet.has(participant.user_id),
    micOn: participant.is_muted === false,
    videoOn: participant.is_video_off === false,
  }
}

export function MeetingParticipantsPanel({
  participants,
  isHost: _isHost,
  viewerRole,
  currentUserId,
  isLocked,
  allowSelfUnmute = true,
  onAdmit,
  onReject,
  onAdmitAll,
  onRemove,
  onPutInWaitingRoom,
  onAllowRejoin,
  onForceMute,
  onAskToUnmute,
  onRequestMute,
  onLowerHand,
  onStopVideo,
  onAskToStartVideo,
  onRename,
  onAssignCoHost,
  onRemoveCoHost,
  onTransferHost,
  onOpenTransferHost,
  onToggleLock,
  onMuteAll,
  onAskAllToUnmute,
  onAskAllToMute,
  onToggleAllowSelfUnmute,
  onRemoveAllExceptHost,
  onClose,
  onInvite,
  raisedHands = {},
  fullWidth,
  spotlightUserId = null,
  onSetSpotlight,
  pinnedUserIds = [],
  onTogglePin,
  speakingUserIds = [],
}: MeetingParticipantsPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'muted' | 'hand' | 'waiting'>('all')
  // Rename: track which user is being renamed
  const [renamingUserId, setRenamingUserId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const spotlightedUserId = spotlightUserId
  const admitted = participants.filter((p) => p.status === 'admitted')
  const waiting = participants.filter((p) => p.status === 'waiting')
  const removed = participants.filter((p) => p.status === 'removed')
  const canModerate = canManageMeeting(viewerRole)
  const canAdmit = canAdmitParticipants(viewerRole)
  const bulkActions = hostBulkActions(viewerRole)
  const normalizedQuery = query.trim().toLowerCase()

  const matchesQuery = (p: MeetingParticipant) => {
    if (!normalizedQuery) return true
    const name = safeMeetingDisplayName(
      p.display_name || p.profile?.full_name || p.profile?.username || '',
    ).toLowerCase()
    return name.includes(normalizedQuery)
  }

  const filteredAdmitted = admitted.filter((p) => {
    if (!matchesQuery(p)) return false
    if (filter === 'hand') return !!raisedHands[p.user_id]
    if (filter === 'muted') return !!p.is_muted
    if (filter === 'waiting') return false
    return true
  })
  const filteredWaiting = waiting.filter(matchesQuery)

  // Zoom participants ordering: You at top, then hands raised, then hosts/cohosts,
  // then talking → unmuted → video on, then everyone else alphabetically.
  const selfAdmitted = filteredAdmitted.find((p) => p.user_id === currentUserId)
  const otherAdmitted = filteredAdmitted.filter((p) => p.user_id !== currentUserId)
  const speakingSet = new Set(speakingUserIds)
  const sortedOthers = [...otherAdmitted].sort((a, b) => {
    const handA = !!raisedHands[a.user_id]
    const handB = !!raisedHands[b.user_id]
    if (handA !== handB) return handA ? -1 : 1
    const isHostA = a.is_host || a.role === 'host' || a.role === 'co-host'
    const isHostB = b.is_host || b.role === 'host' || b.role === 'co-host'
    if (isHostA !== isHostB) return isHostA ? -1 : 1
    return compareMeetingActivity(
      participantActivitySignals(a, speakingSet),
      participantActivitySignals(b, speakingSet),
    )
  })
  const displayAdmitted = selfAdmitted ? [selfAdmitted, ...sortedOthers] : sortedOthers

  const footerMenuItems: MoreAction[] = []
  if (bulkActions.includes('ask_all_to_unmute') && onAskAllToUnmute) {
    footerMenuItems.push({
      key: 'ask-all-unmute',
      label: 'Ask all to unmute',
      onPress: onAskAllToUnmute,
    })
  }
  if (onAskAllToMute) {
    footerMenuItems.push({
      key: 'ask-all-mute',
      label: 'Mute participants upon entry',
      onPress: onAskAllToMute,
    })
  }
  if (bulkActions.includes('lock_meeting') && onToggleLock) {
    footerMenuItems.push({
      key: 'lock-meeting',
      label: isLocked ? 'Unlock meeting' : 'Lock meeting',
      onPress: onToggleLock,
    })
  }
  if (onOpenTransferHost) {
    footerMenuItems.push({
      key: 'transfer-host',
      label: 'Transfer host…',
      onPress: onOpenTransferHost,
    })
  }
  if (canModerate && onToggleAllowSelfUnmute) {
    footerMenuItems.push({
      key: 'allow-self-unmute',
      label: allowSelfUnmute ? 'Prevent participants from unmuting' : 'Allow participants to unmute',
      onPress: onToggleAllowSelfUnmute,
    })
  }
  if (bulkActions.includes('remove_all_except_host') && onRemoveAllExceptHost) {
    footerMenuItems.push({
      key: 'remove-all-except-host',
      label: 'Remove all except host',
      onPress: onRemoveAllExceptHost,
    })
  }

  const renamingParticipant = renamingUserId
    ? participants.find((p) => p.user_id === renamingUserId)
    : null

  return (
    <>
      <AppBottomSheet
        open={!!renamingUserId}
        onOpenChange={(next) => {
          if (!next) setRenamingUserId(null)
        }}
        title="Rename participant"
        showHandle
        scrollable={false}
        footer={
          <XStack gap="$2" width="100%">
            <Button
              tone="outline"
              flex={1}
              borderRadius={8}
              onPress={() => setRenamingUserId(null)}
            >
              Cancel
            </Button>
            <Button
              tone="primary"
              flex={1}
              borderRadius={8}
              disabled={!renameValue.trim()}
              onPress={() => {
                if (renamingUserId && renameValue.trim() && onRename) {
                  onRename(renamingUserId, renameValue.trim())
                }
                setRenamingUserId(null)
              }}
            >
              Rename
            </Button>
          </XStack>
        }
      >
        <YStack gap="$3">
          {renamingParticipant ? (
            <Text fontSize={13} color={coworkUi.textSecondary}>
              Renaming{' '}
              {safeMeetingDisplayName(
                renamingParticipant.display_name ||
                  renamingParticipant.profile?.full_name ||
                  renamingParticipant.profile?.username,
              )}{' '}
              — session only
            </Text>
          ) : null}
          <Input
            value={renameValue}
            onChangeText={setRenameValue}
            placeholder="Enter new name"
            autoFocus
            backgroundColor={coworkUi.surfaceElevated}
            borderColor={coworkUi.borderSoft}
            color={coworkUi.text}
            borderRadius={10}
            maxLength={60}
          />
        </YStack>
      </AppBottomSheet>

      <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title={`Participants (${admitted.length})`}
        subtitle={waiting.length ? `${waiting.length} waiting` : undefined}
        icon={<Icons.Users size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />

      <YStack paddingHorizontal="$3" paddingTop="$2" gap="$2" flexShrink={0}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search participants"
          backgroundColor={coworkUi.surfaceMuted}
          borderColor={coworkUi.borderSoft}
          color={coworkUi.text}
          placeholderTextColor={coworkUi.textMuted}
          borderRadius={10}
          height={38}
          fontSize={13}
        />
        <XStack gap="$1.5" flexWrap="wrap" paddingBottom="$1">
          {(
            [
              ['all', 'All'],
              ['hand', 'Hand raised'],
              ['muted', 'Muted'],
              ['waiting', 'Waiting'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              tone={filter === key ? 'primary' : 'outline'}
              size="$2"
              height={28}
              paddingHorizontal={10}
              borderRadius={999}
              onPress={() => setFilter(key)}
            >
              <Text fontSize={12} fontWeight="600" color={filter === key ? '#fff' : coworkUi.text}>
                {label}
                {key === 'waiting' && waiting.length ? ` (${waiting.length})` : ''}
              </Text>
            </Button>
          ))}
        </XStack>
      </YStack>

      <RNScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <YStack gap="$3">
          {(filter === 'waiting' || filter === 'all') && filteredWaiting.length > 0 ? (
            <YStack gap="$2">
              <XStack alignItems="center" justifyContent="space-between">
                <CoWorkSectionLabel>Waiting room ({filteredWaiting.length})</CoWorkSectionLabel>
                {canAdmit && onAdmitAll ? (
                  <Button tone="primary" size="$2" height={28} borderRadius={999} onPress={onAdmitAll}>
                    Admit all
                  </Button>
                ) : null}
              </XStack>
              {filteredWaiting.map((p) => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  isSelf={false}
                  action={
                    canAdmit ? (
                      <XStack gap="$1.5">
                        <Button tone="primary" size="$2" height={30} borderRadius={8} onPress={() => onAdmit(p.id)}>
                          Admit
                        </Button>
                        {onReject ? (
                          <Button tone="outline" size="$2" height={30} borderRadius={8} onPress={() => onReject(p.id)}>
                            Deny
                          </Button>
                        ) : null}
                      </XStack>
                    ) : null
                  }
                />
              ))}
            </YStack>
          ) : null}

          {filter !== 'waiting' ? (
            <YStack gap="$2">
              <CoWorkSectionLabel>In the meeting ({displayAdmitted.length})</CoWorkSectionLabel>
              {displayAdmitted.length === 0 ? (
                <Text fontSize={13} color={coworkUi.textMuted} paddingVertical="$2">
                  No participants match.
                </Text>
              ) : null}
              {displayAdmitted.map((p) => {
                const role = meetingRoleFromFlags({
                  role: p.role,
                  isHost: p.is_host,
                  userId: p.user_id,
                })
                const isSelf = p.user_id === currentUserId
                const actions = participantRowActions({
                  viewerRole,
                  targetRole: role,
                  isSelf,
                  isMuted: !!p.is_muted,
                  isVideoOff: !!p.is_video_off,
                  handRaised: !!raisedHands[p.user_id],
                })
                const menuItems: MoreAction[] = []
                if (actions.includes('mute') && onForceMute) {
                  menuItems.push({ key: 'mute', label: 'Mute', onPress: () => onForceMute(p.user_id) })
                }
                if (actions.includes('ask_to_unmute') && onAskToUnmute) {
                  menuItems.push({
                    key: 'ask-unmute',
                    label: 'Ask to unmute',
                    onPress: () => onAskToUnmute(p.user_id),
                  })
                }
                if (actions.includes('ask_to_mute') && onRequestMute) {
                  menuItems.push({
                    key: 'ask-mute',
                    label: 'Ask to mute',
                    onPress: () => onRequestMute(p.user_id),
                  })
                }
                if (actions.includes('lower_hand') && onLowerHand) {
                  menuItems.push({
                    key: 'lower-hand',
                    label: 'Lower hand',
                    onPress: () => onLowerHand(p.user_id),
                  })
                }
                // Stop video (host, when participant has video on)
                if (actions.includes('stop_video') && !p.is_video_off && onStopVideo) {
                  menuItems.push({
                    key: 'stop-video',
                    label: 'Stop video',
                    onPress: () => onStopVideo(p.user_id),
                  })
                }
                // Ask to start video (host only, when video is off)
                if (actions.includes('stop_video') && p.is_video_off && onAskToStartVideo) {
                  menuItems.push({
                    key: 'ask-start-video',
                    label: 'Ask to start video',
                    onPress: () => onAskToStartVideo(p.user_id),
                  })
                }
                if (actions.includes('make_co_host') && onAssignCoHost) {
                  menuItems.push({
                    key: 'make-cohost',
                    label: 'Make co-host',
                    onPress: () => onAssignCoHost(p.user_id),
                  })
                }
                if (actions.includes('remove_co_host') && onRemoveCoHost) {
                  menuItems.push({
                    key: 'remove-cohost',
                    label: 'Remove co-host',
                    onPress: () => onRemoveCoHost(p.user_id),
                  })
                }
                if (actions.includes('make_host') && onTransferHost) {
                  menuItems.push({
                    key: 'make-host',
                    label: 'Make host',
                    onPress: () => onTransferHost(p.user_id),
                  })
                }
                // Spotlight (room-wide) + Pin (local view)
                if (!isSelf) {
                  const isSpotlighted = spotlightedUserId === p.user_id
                  const isPinned = pinnedUserIds.includes(p.user_id)
                  if (canModerate && onSetSpotlight) {
                    menuItems.push({
                      key: 'spotlight',
                      label: isSpotlighted ? 'Remove spotlight' : 'Spotlight for everyone',
                      onPress: () => onSetSpotlight(isSpotlighted ? null : p.user_id),
                    })
                  }
                  if (onTogglePin) {
                    menuItems.push({
                      key: 'pin',
                      label: isPinned ? 'Unpin video' : 'Pin video',
                      onPress: () => onTogglePin(p.user_id),
                    })
                  }
                }
                // Rename (self or host)
                if ((isSelf || canModerate) && onRename) {
                  menuItems.push({
                    key: 'rename',
                    label: 'Rename',
                    onPress: () => {
                      const current =
                        p.display_name || p.profile?.full_name || p.profile?.username || ''
                      setRenameValue(current)
                      setRenamingUserId(p.user_id)
                    },
                  })
                }
                if (actions.includes('put_in_waiting_room') && onPutInWaitingRoom) {
                  menuItems.push({
                    key: 'waiting-room',
                    label: 'Put in waiting room',
                    onPress: () => onPutInWaitingRoom(p.id),
                  })
                }
                if (actions.includes('remove') && onRemove) {
                  menuItems.push({ key: 'remove', label: 'Remove', onPress: () => onRemove(p.id) })
                }

                return (
                  <ParticipantRow
                    key={p.id}
                    participant={p}
                    isSelf={isSelf}
                    handRaised={!!raisedHands[p.user_id]}
                    isSpotlighted={spotlightedUserId === p.user_id}
                    action={menuItems.length > 0 ? <MoreActionsMenu items={menuItems} /> : null}
                  />
                )
              })}
            </YStack>
          ) : null}

          {canModerate && removed.length > 0 ? (
            <YStack gap="$2" paddingTop="$2">
              <CoWorkSectionLabel>Removed ({removed.length})</CoWorkSectionLabel>
              {removed.map((participant) => (
                <ParticipantRow
                  key={participant.id}
                  participant={participant}
                  isSelf={false}
                  action={
                    onAllowRejoin ? (
                      <Button
                        tone="outline"
                        size="$2"
                        height={28}
                        borderRadius={8}
                        onPress={() => onAllowRejoin(participant.id)}
                      >
                        Allow rejoin
                      </Button>
                    ) : null
                  }
                />
              ))}
            </YStack>
          ) : null}
        </YStack>
      </RNScrollView>

      {/* Permanently Docked Zoom Footer Toolbar */}
      <XStack
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal="$3.5"
        paddingVertical="$2.5"
        borderTopWidth={1}
        borderTopColor={coworkUi.borderSoft}
        backgroundColor={coworkUi.surfaceElevated}
        flexShrink={0}
      >
        <Button
          tone="outline"
          size="$2"
          height={32}
          borderRadius={8}
          icon={<Icons.UserPlus size={14} color={coworkUi.text} />}
          onPress={onInvite}
        >
          Invite
        </Button>

        <XStack alignItems="center" gap="$2">
          {canModerate && bulkActions.includes('mute_all') && onMuteAll ? (
            <Button
              tone="outline"
              size="$2"
              height={32}
              borderRadius={8}
              icon={<Icons.MicOff size={14} color={coworkUi.text} />}
              onPress={onMuteAll}
            >
              Mute All
            </Button>
          ) : null}

          {canModerate && footerMenuItems.length > 0 ? (
            <MoreActionsMenu
              items={footerMenuItems}
              placement="top-end"
              trigger={
                <Button
                  tone="outline"
                  size="$2"
                  height={32}
                  paddingHorizontal={10}
                  borderRadius={8}
                  icon={<Icons.MoreHorizontal size={16} color={coworkUi.text} />}
                  accessibilityLabel="More host actions"
                />
              }
            />
          ) : null}
        </XStack>
      </XStack>
    </CoWorkPanelShell>
    </>
  )
}

type MoreAction = {
  key: string
  label: string
  onPress: () => void
}

function MoreActionsMenu({
  items,
  placement = 'bottom-end',
  trigger,
}: {
  items: MoreAction[]
  placement?: 'bottom-end' | 'top-end'
  trigger?: ReactNode
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const palette = useMeetingControlPalette()
  const [open, setOpen] = useState(false)

  if (Platform.OS !== 'web') {
    return (
      <YStack>
        {trigger ? (
          <Pressable onPress={() => setOpen((current) => !current)}>
            {trigger}
          </Pressable>
        ) : (
          <MeetingSheetButton
            accessibilityLabel="More participant actions"
            onPress={() => setOpen((current) => !current)}
            style={{ width: 34, height: 34, borderRadius: 8 }}
          >
            <Icons.MoreHorizontal size={16} color={coworkUi.textMuted} />
          </MeetingSheetButton>
        )}
        {open ? (
          <YStack
            marginTop={6}
            minWidth={200}
            padding="$2"
            borderRadius={12}
            borderWidth={1}
            borderColor={coworkUi.borderSoft}
            backgroundColor={coworkUi.surface}
            gap={2}
          >
            {items.map((item) => (
              <MeetingSheetButton
                key={item.key}
                accessibilityLabel={item.label}
                onPress={() => {
                  setOpen(false)
                  item.onPress()
                }}
                style={{
                  minHeight: 38,
                  borderRadius: 8,
                  justifyContent: 'flex-start',
                  paddingHorizontal: 12,
                }}
              >
                <Text fontSize={13} fontWeight="600" color={coworkUi.text}>
                  {item.label}
                </Text>
              </MeetingSheetButton>
            ))}
          </YStack>
        ) : null}
      </YStack>
    )
  }

  // Popover.Trigger toggles `open` itself — a second toggle in the child's
  // onPress cancels it out and the menu never appears.
  return (
    <Popover open={open} onOpenChange={setOpen} placement={placement} allowFlip>
      <Popover.Trigger asChild>
        {trigger ?? (
          <Button
            tone="ghost"
            size="$1"
            circular
            icon={<Icons.MoreHorizontal size={15} color={coworkUi.textMuted} />}
            accessibilityLabel="More participant actions"
            onPress={(event) => event?.stopPropagation?.()}
          />
        )}
      </Popover.Trigger>
      <Popover.Content
        zIndex={400000}
        minWidth={210}
        padding="$2"
        borderRadius={12}
        borderWidth={1}
        backgroundColor={coworkUi.surfaceElevated}
        borderColor={coworkUi.borderSoft}
        style={{
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        }}
      >
        <YStack gap={2}>
          {items.map((item) => (
            <XStack
              key={item.key}
              alignItems="center"
              minHeight={36}
              paddingHorizontal="$3"
              borderRadius={8}
              cursor="pointer"
              hoverStyle={{ backgroundColor: palette.bgHover }}
              pressStyle={{ opacity: 0.8 }}
              onPress={() => {
                setOpen(false)
                item.onPress()
              }}
            >
              <Text fontSize={13} fontWeight="600" color={coworkUi.text}>
                {item.label}
              </Text>
            </XStack>
          ))}
        </YStack>
      </Popover.Content>
    </Popover>
  )
}

function ParticipantRow({
  participant,
  action,
  handRaised,
  isSelf,
  isSpotlighted,
}: {
  participant: MeetingParticipant
  action?: ReactNode
  handRaised?: boolean
  isSelf?: boolean
  isSpotlighted?: boolean
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const palette = useMeetingControlPalette()
  const baseName = safeMeetingDisplayName(
    participant.display_name ||
      participant.profile?.full_name ||
      participant.profile?.username,
  )
  const role = meetingRoleFromFlags({
    role: participant.role,
    isHost: participant.is_host,
  })
  const isHost = role === 'host'
  const isCoHost = role === 'co-host'

  const suffix = isSelf
    ? isHost
      ? ' (Host, me)'
      : isCoHost
        ? ' (Co-host, me)'
        : ' (me)'
    : isHost
      ? ' (Host)'
      : isCoHost
        ? ' (Co-host)'
        : ''

  const micOn = !participant.is_muted
  const cameraOn = !participant.is_video_off

  return (
    <XStack
      alignItems="center"
      gap="$2"
      justifyContent="space-between"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius={10}
      backgroundColor={isSpotlighted ? 'rgba(216,27,96,0.08)' : coworkUi.surfaceMuted}
      borderWidth={1}
      borderColor={isSpotlighted ? coworkUi.borderAccent : handRaised ? coworkUi.borderAccent : 'transparent'}
      hoverStyle={{ backgroundColor: palette.bgHover }}
    >
      <XStack alignItems="center" gap="$2.5" flex={1} minWidth={0}>
        <Avatar name={baseName} src={participant.profile?.avatar_url ?? undefined} size="$4" />
        <YStack flex={1} minWidth={0} gap={2}>
          <XStack alignItems="center" gap="$1.5" flexWrap="nowrap">
            <Text fontSize={14} fontWeight="700" color={coworkUi.text} numberOfLines={1}>
              {baseName}
              <Text fontSize={12} color={coworkUi.textMuted} fontWeight="400">
                {suffix}
              </Text>
            </Text>
            {handRaised ? <Text fontSize={13}>✋</Text> : null}
            {isSpotlighted ? (
              <XStack
                alignItems="center"
                gap={3}
                paddingHorizontal={5}
                paddingVertical={2}
                borderRadius={4}
                backgroundColor={coworkUi.brandMuted}
              >
                <Icons.Pin size={11} color={coworkUi.brandLight} />
                <Text fontSize={10} fontWeight="700" color={coworkUi.brandLight}>Spotlight</Text>
              </XStack>
            ) : null}
          </XStack>
          {role !== 'participant' && !suffix ? (
            <MeetingRoleBadge role={role} />
          ) : (
            <Text fontSize={11} color={coworkUi.textMuted} numberOfLines={1}>
              {cameraOn ? 'Video on' : 'Camera off'}
              {' · '}
              {micOn ? 'Mic on' : 'Muted'}
            </Text>
          )}
        </YStack>
      </XStack>

      <XStack alignItems="center" gap="$2">
        <Icons.Mic size={15} color={micOn ? coworkUi.live : coworkUi.danger} />
        <Icons.Video size={15} color={cameraOn ? coworkUi.live : coworkUi.danger} />
        {action}
      </XStack>
    </XStack>
  )
}
