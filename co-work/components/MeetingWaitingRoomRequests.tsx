import { useState } from 'react'

import { Avatar, Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { MeetingParticipant } from '~/co-work/lib/types'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'

type MeetingWaitingRoomRequestsProps = {
  participants: MeetingParticipant[]
  onAdmit: (participantId: string) => Promise<void>
  onReject: (participantId: string) => Promise<void>
  onAdmitAll: () => Promise<void>
  onReview: () => void
}

export function MeetingWaitingRoomRequests({
  participants,
  onAdmit,
  onReject,
  onAdmitAll,
  onReview,
}: MeetingWaitingRoomRequestsProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const [busy, setBusy] = useState<'admit' | 'reject' | 'all' | null>(null)
  const first = participants[0]
  if (!first) return null

  const name = safeMeetingDisplayName(
    first.display_name || first.profile?.full_name || first.profile?.username,
    'A participant',
  )
  const remaining = participants.length - 1

  const run = async (action: 'admit' | 'reject' | 'all', task: () => Promise<void>) => {
    if (busy) return
    setBusy(action)
    try {
      await task()
    } catch (cause) {
      toast.show('Waiting room action failed', {
        tone: 'danger',
        message: cause instanceof Error ? cause.message : 'Please try again.',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      backgroundColor={coworkUi.warningMuted}
      borderBottomWidth={1}
      borderBottomColor={coworkUi.borderSoft}
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      flexWrap="wrap"
    >
      <XStack alignItems="center" gap="$3" flex={1} minWidth={180}>
        <Avatar name={name} src={first.profile?.avatar_url ?? undefined} size="$3" />
        <YStack flex={1} gap={2}>
          <XStack alignItems="center" gap="$2">
            <Icons.UserPlus size={15} color={coworkUi.warning} />
            <Text color={coworkUi.warning} fontSize={13} fontWeight="800" numberOfLines={1}>
              {name} wants to join
            </Text>
          </XStack>
          <Text color={coworkUi.textSecondary} fontSize={11}>
            {remaining > 0 ? `${remaining} more waiting · ` : ''}Review before admitting
          </Text>
        </YStack>
      </XStack>

      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Button
          tone="primary"
          size="$2"
          borderRadius={999}
          disabled={!!busy}
          icon={busy === 'admit' ? <Spinner size="small" /> : undefined}
          onPress={() => void run('admit', () => onAdmit(first.id))}
        >
          Admit
        </Button>
        <Button
          tone="outline"
          size="$2"
          borderRadius={999}
          disabled={!!busy}
          onPress={() => void run('reject', () => onReject(first.id))}
        >
          {busy === 'reject' ? 'Rejecting…' : 'Reject'}
        </Button>
        {participants.length > 1 ? (
          <Button
            tone="outline"
            size="$2"
            borderRadius={999}
            disabled={!!busy}
            onPress={() => void run('all', onAdmitAll)}
          >
            {busy === 'all' ? 'Admitting…' : 'Admit all'}
          </Button>
        ) : null}
        <Button tone="ghost" size="$2" borderRadius={999} disabled={!!busy} onPress={onReview}>
          Review
        </Button>
      </XStack>
    </XStack>
  )
}
