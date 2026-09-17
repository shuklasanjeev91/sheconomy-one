import { useState, type ReactNode } from 'react'

import {
  Avatar,
  Button,
  Icons,
  Popover,
  PopoverContent,
  ScrollView,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { CoWorkPanelShell, CoWorkSectionLabel } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { MeetingRoleBadge } from '~/co-work/components/MeetingRoleBadge'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { MeetingParticipant, MeetingRole } from '~/co-work/lib/types'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'
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
  onAdmit: (participantId: string) => void
  onReject?: (participantId: string) => void
  onAdmitAll?: () => void
  onRemove?: (participantId: string) => void
  onAllowRejoin?: (participantId: string) => void
  onForceMute?: (userId: string) => void
  onAskToUnmute?: (userId: string) => void
  onRequestMute?: (userId: string) => void
  onStopVideo?: (userId: string) => void
  onAssignCoHost?: (userId: string) => void
  onRemoveCoHost?: (userId: string) => void
  onTransferHost?: (userId: string) => void
  onToggleLock?: () => void
  onMuteAll?: () => void
  onAskAllToUnmute?: () => void
  onAskAllToMute?: () => void
  onRemoveAllExceptHost?: () => void
  onClose: () => void
  raisedHands?: Record<string, boolean>
  fullWidth?: boolean
}

export function MeetingParticipantsPanel({
  participants,
  isHost: _isHost,
  viewerRole,
  currentUserId,
  isLocked,
  onAdmit,
  onReject,
  onAdmitAll,
  onRemove,
  onAllowRejoin,
  onForceMute,
  onAskToUnmute,
  onRequestMute,
  onStopVideo,
  onAssignCoHost,
  onRemoveCoHost,
  onTransferHost,
  onToggleLock,
  onMuteAll,
  onAskAllToUnmute,
  onAskAllToMute,
  onRemoveAllExceptHost,
  onClose,
  raisedHands = {},
  fullWidth,
}: MeetingParticipantsPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const admitted = participants.filter((p) => p.status === 'admitted')
  const waiting = participants.filter((p) => p.status === 'waiting')
  const removed = participants.filter((p) => p.status === 'removed')
  const canModerate = canManageMeeting(viewerRole)
  const canAdmit = canAdmitParticipants(viewerRole)
  const bulkActions = hostBulkActions(viewerRole)

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title={`Participants (${admitted.length})`}
        subtitle={waiting.length ? `${waiting.length} waiting` : undefined}
        icon={<Icons.Users size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />

      <ScrollView flex={1} padding="$3">
        <YStack gap="$4">
          {canModerate ? (
            <YStack gap="$2">
              <CoWorkSectionLabel>Host controls</CoWorkSectionLabel>
              <XStack gap="$2" flexWrap="wrap">
                {bulkActions.includes('mute_all') && onMuteAll ? (
                  <Button tone="outline" size="$2" borderRadius={999} onPress={onMuteAll}>
                    Mute all
                  </Button>
                ) : null}
                {bulkActions.includes('ask_all_to_unmute') && onAskAllToUnmute ? (
                  <Button tone="outline" size="$2" borderRadius={999} onPress={onAskAllToUnmute}>
                    Ask all to unmute
                  </Button>
                ) : null}
                {bulkActions.includes('remove_all_except_host') && onRemoveAllExceptHost ? (
                  <Button tone="outline" size="$2" borderRadius={999} onPress={onRemoveAllExceptHost}>
                    Remove all except host
                  </Button>
                ) : null}
                {bulkActions.includes('lock_meeting') && onToggleLock ? (
                  <Button tone="outline" size="$2" borderRadius={999} onPress={onToggleLock}>
                    {isLocked ? 'Unlock meeting' : 'Lock meeting'}
                  </Button>
                ) : null}
                {onAskAllToMute ? (
                  <Button tone="ghost" size="$2" borderRadius={999} onPress={onAskAllToMute}>
                    Ask all to mute
                  </Button>
                ) : null}
              </XStack>
            </YStack>
          ) : null}

          {waiting.length > 0 ? (
            <YStack gap="$2">
              <XStack alignItems="center" justifyContent="space-between">
                <CoWorkSectionLabel>Waiting room</CoWorkSectionLabel>
                {canAdmit && onAdmitAll ? (
                  <Button tone="primary" size="$2" borderRadius={999} onPress={onAdmitAll}>
                    Admit all
                  </Button>
                ) : null}
              </XStack>
              {waiting.map((p) => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  action={
                    canAdmit ? (
                      <XStack gap="$2">
                        <Button tone="primary" size="$2" borderRadius={999} onPress={() => onAdmit(p.id)}>
                          Admit
                        </Button>
                        {onReject ? (
                          <Button tone="outline" size="$2" borderRadius={999} onPress={() => onReject(p.id)}>
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

          <YStack gap="$2">
            <CoWorkSectionLabel>In the meeting</CoWorkSectionLabel>
            {admitted.length === 0 ? (
              <Text fontSize={13} color={coworkUi.textMuted} paddingVertical="$2">
                No participants yet.
              </Text>
            ) : null}
            {[...admitted]
              .sort((a, b) => Number(!!raisedHands[b.user_id]) - Number(!!raisedHands[a.user_id]))
              .map((p) => {
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
                })
                const moreItems: MoreAction[] = []
                if (actions.includes('ask_to_mute') && onRequestMute) {
                  moreItems.push({
                    key: 'ask-mute',
                    label: 'Ask to mute',
                    onPress: () => onRequestMute(p.user_id),
                  })
                }
                if (actions.includes('remove_co_host') && onRemoveCoHost) {
                  moreItems.push({
                    key: 'remove-cohost',
                    label: 'Remove co-host',
                    onPress: () => onRemoveCoHost(p.user_id),
                  })
                }
                if (actions.includes('make_host') && onTransferHost) {
                  moreItems.push({
                    key: 'make-host',
                    label: 'Make host',
                    onPress: () => onTransferHost(p.user_id),
                  })
                }

                const hasPrimary =
                  actions.includes('mute') ||
                  actions.includes('ask_to_unmute') ||
                  actions.includes('stop_video') ||
                  actions.includes('make_co_host') ||
                  actions.includes('remove')

                return (
                  <ParticipantRow
                    key={p.id}
                    participant={p}
                    handRaised={!!raisedHands[p.user_id]}
                    action={
                      hasPrimary || moreItems.length > 0 ? (
                        <XStack gap="$1" alignItems="center" flexWrap="wrap" justifyContent="flex-end">
                          {actions.includes('mute') && onForceMute ? (
                            <Button tone="ghost" size="$1" onPress={() => onForceMute(p.user_id)}>
                              Mute
                            </Button>
                          ) : null}
                          {actions.includes('ask_to_unmute') && onAskToUnmute ? (
                            <Button tone="ghost" size="$1" onPress={() => onAskToUnmute(p.user_id)}>
                              Ask to unmute
                            </Button>
                          ) : null}
                          {actions.includes('stop_video') && onStopVideo ? (
                            <Button tone="ghost" size="$1" onPress={() => onStopVideo(p.user_id)}>
                              Stop video
                            </Button>
                          ) : null}
                          {actions.includes('make_co_host') && onAssignCoHost ? (
                            <Button tone="ghost" size="$1" onPress={() => onAssignCoHost(p.user_id)}>
                              Make co-host
                            </Button>
                          ) : null}
                          {actions.includes('remove') && onRemove ? (
                            <Button tone="outline" size="$1" onPress={() => onRemove(p.id)}>
                              Remove
                            </Button>
                          ) : null}
                          {moreItems.length > 0 ? <MoreActionsMenu items={moreItems} /> : null}
                        </XStack>
                      ) : null
                    }
                  />
                )
              })}
          </YStack>

          {canModerate && removed.length > 0 ? (
            <YStack gap="$2">
              <CoWorkSectionLabel>Removed</CoWorkSectionLabel>
              {removed.map((participant) => (
                <ParticipantRow
                  key={participant.id}
                  participant={participant}
                  action={
                    onAllowRejoin ? (
                      <Button
                        tone="outline"
                        size="$2"
                        borderRadius={999}
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
      </ScrollView>
    </CoWorkPanelShell>
  )
}

type MoreAction = {
  key: string
  label: string
  onPress: () => void
}

function MoreActionsMenu({ items }: { items: MoreAction[] }) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" allowFlip>
      <Popover.Trigger asChild>
        <Button
          tone="ghost"
          size="$1"
          circular
          icon={<Icons.MoreHorizontal size={16} color={coworkUi.textMuted} />}
          accessibilityLabel="More participant actions"
          onPress={(event) => {
            event?.stopPropagation?.()
            setOpen((current) => !current)
          }}
        />
      </Popover.Trigger>
      <PopoverContent
        zIndex={400000}
        minWidth={200}
        padding="$2"
        backgroundColor={coworkUi.surface}
        borderColor={coworkUi.borderSoft}
      >
        <YStack gap={2}>
          {items.map((item) => (
            <XStack
              key={item.key}
              alignItems="center"
              minHeight={40}
              paddingHorizontal="$3"
              borderRadius={10}
              cursor="pointer"
              hoverStyle={{ backgroundColor: coworkUi.surfaceMuted }}
              pressStyle={{ opacity: 0.8 }}
              onPress={() => {
                setOpen(false)
                item.onPress()
              }}
            >
              <Text fontSize={14} fontWeight="600" color={coworkUi.text}>
                {item.label}
              </Text>
            </XStack>
          ))}
        </YStack>
      </PopoverContent>
    </Popover>
  )
}

function ParticipantRow({
  participant,
  action,
  handRaised,
}: {
  participant: MeetingParticipant
  action?: ReactNode
  handRaised?: boolean
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const name = safeMeetingDisplayName(
    participant.display_name ||
      participant.profile?.full_name ||
      participant.profile?.username,
  )
  const role = meetingRoleFromFlags({
    role: participant.role,
    isHost: participant.is_host,
  })
  const micOn = !participant.is_muted
  const cameraOn = !participant.is_video_off

  return (
    <XStack
      alignItems="center"
      gap="$2"
      justifyContent="space-between"
      padding="$3"
      borderRadius={14}
      backgroundColor="rgba(255,255,255,0.04)"
      borderWidth={1}
      borderColor={handRaised ? coworkUi.borderAccent : coworkUi.borderSoft}
    >
      <XStack alignItems="center" gap="$3" flex={1} minWidth={0}>
        <Avatar name={name} src={participant.profile?.avatar_url ?? undefined} size="$3" />
        <YStack flex={1} gap={4} minWidth={0}>
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            <Text fontSize={14} fontWeight="700" color={coworkUi.text} numberOfLines={1}>
              {name}
            </Text>
            <MeetingRoleBadge role={role} />
            {handRaised ? <Text fontSize={14}>✋</Text> : null}
          </XStack>
          <XStack gap="$3" alignItems="center" flexWrap="wrap">
            <MediaStatus
              on={micOn}
              onIcon={Icons.Mic}
              offIcon={Icons.MicOff}
              label={micOn ? 'Mic on' : 'Muted'}
            />
            <MediaStatus
              on={cameraOn}
              onIcon={Icons.Video}
              offIcon={Icons.VideoOff}
              label={cameraOn ? 'Camera on' : 'Camera off'}
            />
          </XStack>
        </YStack>
      </XStack>
      {action}
    </XStack>
  )
}

function MediaStatus({
  on,
  onIcon: OnIcon,
  offIcon: OffIcon,
  label,
}: {
  on: boolean
  onIcon: typeof Icons.Mic
  offIcon: typeof Icons.MicOff
  label: string
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const Icon = on ? OnIcon : OffIcon
  return (
    <XStack alignItems="center" gap={4}>
      <Icon size={13} color={on ? coworkUi.live : coworkUi.textMuted} />
      <Text fontSize={11} color={coworkUi.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}
