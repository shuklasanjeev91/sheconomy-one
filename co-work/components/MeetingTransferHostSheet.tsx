import { useMemo, useState } from 'react'

import {
  AppBottomSheet,
  Avatar,
  Button,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { MeetingRoleBadge } from '~/co-work/components/MeetingRoleBadge'
import { confirmMeetingAction } from '~/co-work/lib/meeting-confirm'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'
import { meetingRoleFromFlags } from '~/co-work/lib/meeting-role-permissions'
import { transferHostCandidates } from '~/co-work/lib/meeting-transfer-host'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { MeetingParticipant } from '~/co-work/lib/types'

type MeetingTransferHostSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  participants: MeetingParticipant[]
  currentUserId: string
  onTransfer: (userId: string) => Promise<void>
}

function participantName(participant: MeetingParticipant) {
  return safeMeetingDisplayName(
    participant.display_name ||
      participant.profile?.full_name ||
      participant.profile?.username,
  )
}

/**
 * Zoom-like host transfer: pick a joined participant, confirm, then transfer.
 */
export function MeetingTransferHostSheet({
  open,
  onOpenChange,
  participants,
  currentUserId,
  onTransfer,
}: MeetingTransferHostSheetProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [busyId, setBusyId] = useState<string | null>(null)

  const candidates = useMemo(
    () => transferHostCandidates(participants, currentUserId),
    [participants, currentUserId],
  )

  const runTransfer = async (participant: MeetingParticipant) => {
    if (busyId) return
    setBusyId(participant.user_id)
    try {
      await onTransfer(participant.user_id)
      onOpenChange(false)
    } finally {
      setBusyId(null)
    }
  }

  const confirmTransfer = (participant: MeetingParticipant) => {
    const name = participantName(participant)
    confirmMeetingAction({
      title: 'Transfer host?',
      message: `Make ${name} the host of this meeting? You’ll become a co-host.`,
      confirmLabel: 'Transfer host',
      cancelLabel: 'Cancel',
      onConfirm: () => void runTransfer(participant),
    })
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Transfer host"
      showHandle
    >
      <YStack gap="$3" paddingHorizontal="$1" paddingBottom="$4">
        <Text fontSize={13} color={coworkUi.textMuted} lineHeight={18}>
          Choose someone who has joined this meeting. They become the host; you stay as a co-host.
        </Text>

        {candidates.length === 0 ? (
          <YStack
            gap="$2"
            padding="$4"
            borderRadius={16}
            backgroundColor={coworkUi.surfaceMuted}
            borderWidth={1}
            borderColor={coworkUi.borderSoft}
            alignItems="center"
          >
            <Text fontSize={15} fontWeight="700" color={coworkUi.text} textAlign="center">
              No one else has joined yet
            </Text>
            <Text fontSize={13} color={coworkUi.textMuted} textAlign="center" lineHeight={18}>
              Invite participants, then transfer the host role to one of them.
            </Text>
          </YStack>
        ) : (
          <YStack gap="$2">
            {candidates.map((participant) => {
              const name = participantName(participant)
              const role = meetingRoleFromFlags({
                role: participant.role,
                isHost: participant.is_host,
              })
              const busy = busyId === participant.user_id
              return (
                <XStack
                  key={participant.id}
                  alignItems="center"
                  gap="$3"
                  padding="$3"
                  borderRadius={14}
                  backgroundColor={coworkUi.surfaceMuted}
                  borderWidth={1}
                  borderColor={coworkUi.borderSoft}
                >
                  <Avatar
                    name={name}
                    src={participant.profile?.avatar_url ?? undefined}
                    size="$3"
                  />
                  <YStack flex={1} gap={4} minWidth={0}>
                    <XStack alignItems="center" gap="$2" flexWrap="wrap">
                      <Text fontSize={14} fontWeight="700" color={coworkUi.text} numberOfLines={1}>
                        {name}
                      </Text>
                      <MeetingRoleBadge role={role} />
                    </XStack>
                    <Text fontSize={11} color={coworkUi.textMuted}>
                      In the meeting
                    </Text>
                  </YStack>
                  <Button
                    tone="primary"
                    size="$2"
                    borderRadius={999}
                    disabled={!!busyId}
                    onPress={() => confirmTransfer(participant)}
                    icon={busy ? <Spinner size="small" color="#fff" /> : undefined}
                  >
                    {busy ? 'Transferring…' : 'Make host'}
                  </Button>
                </XStack>
              )
            })}
          </YStack>
        )}
      </YStack>
    </AppBottomSheet>
  )
}
