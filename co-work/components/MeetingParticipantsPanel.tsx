import type { ReactNode } from 'react'

import { Avatar, Badge, Button, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { CoWorkPanelShell, CoWorkSectionLabel } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { MeetingParticipant } from '~/co-work/lib/types'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'

type MeetingParticipantsPanelProps = {
  participants: MeetingParticipant[]
  isHost: boolean
  onAdmit: (participantId: string) => void
  onReject?: (participantId: string) => void
  onAdmitAll?: () => void
  onRemove?: (participantId: string) => void
  onAllowRejoin?: (participantId: string) => void
  onClose: () => void
  raisedHands?: Record<string, boolean>
  fullWidth?: boolean
}

export function MeetingParticipantsPanel({
  participants,
  isHost,
  onAdmit,
  onReject,
  onAdmitAll,
  onRemove,
  onAllowRejoin,
  onClose,
  raisedHands = {},
  fullWidth,
}: MeetingParticipantsPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const admitted = participants.filter((p) => p.status === 'admitted')
  const waiting = participants.filter((p) => p.status === 'waiting')
  const removed = participants.filter((p) => p.status === 'removed')

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="People"
        subtitle={`${admitted.length} joined${waiting.length ? ` · ${waiting.length} waiting` : ''}`}
        icon={<Icons.Users size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />

      <ScrollView flex={1} padding="$3">
        <YStack gap="$4">
          {waiting.length > 0 ? (
            <YStack gap="$2">
              <XStack alignItems="center" justifyContent="space-between">
                <CoWorkSectionLabel>Waiting room</CoWorkSectionLabel>
                {isHost && onAdmitAll ? (
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
                    isHost ? (
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
              .map((p) => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  handRaised={!!raisedHands[p.user_id]}
                  action={
                    isHost && !p.is_host && onRemove ? (
                      <Button
                        tone="outline"
                        size="$2"
                        borderRadius={999}
                        onPress={() => onRemove(p.id)}
                      >
                        Remove
                      </Button>
                    ) : null
                  }
                />
              ))}
          </YStack>

          {isHost && removed.length > 0 ? (
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
      <XStack alignItems="center" gap="$3" flex={1}>
        <Avatar name={name} src={participant.profile?.avatar_url ?? undefined} size="$3" />
        <YStack flex={1} gap={3}>
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            <Text fontSize={14} fontWeight="700" color={coworkUi.text} numberOfLines={1}>
              {name}
            </Text>
            {participant.is_host ? (
              <Badge tone="brand" size="sm">
                Host
              </Badge>
            ) : null}
            {handRaised ? <Text fontSize={14}>✋</Text> : null}
          </XStack>
          <XStack gap="$2" flexWrap="wrap">
            <StatusDot active={!participant.is_muted} label={participant.is_muted ? 'Muted' : 'Mic on'} />
            <StatusDot
              active={!participant.is_video_off}
              label={participant.is_video_off ? 'Camera off' : 'Camera on'}
            />
          </XStack>
        </YStack>
      </XStack>
      {action}
    </XStack>
  )
}

function StatusDot({ active, label }: { active: boolean; label: string }) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  return (
    <XStack alignItems="center" gap={4}>
      <YStack
        width={6}
        height={6}
        borderRadius={999}
        backgroundColor={active ? coworkUi.live : coworkUi.textMuted}
      />
      <Text fontSize={11} color={coworkUi.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}