import { useMemo, useState } from 'react'

import {
  Button,
  Field,
  Icons,
  Input,
  ScrollView,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { CoWorkPanelShell, CoWorkSectionLabel, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { useMeetingBreakouts } from '~/co-work/hooks/useMeetingBreakouts'
import type { MeetingBreakoutRoom } from '~/co-work/lib/meeting-breakouts'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type BreakoutParticipant = {
  user_id: string
  display_name?: string
}

type MeetingBreakoutPanelProps = {
  meetingId: string
  userId: string
  meetingLiveKitRoomId: string
  participants: BreakoutParticipant[]
  canModerate: boolean
  onClose: () => void
  onOpenBreakouts?: () => void
  onCloseBreakouts?: () => void
  onJoinBreakoutRoom?: (liveKitRoomName: string) => void
  fullWidth?: boolean
}

function breakoutStatusLabel(status: MeetingBreakoutRoom['status']) {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'open':
      return 'Open'
    case 'closed':
      return 'Closed'
    default:
      return status
  }
}

function breakoutStatusTone(status: MeetingBreakoutRoom['status']): 'warning' | 'live' | 'brand' {
  if (status === 'open') return 'live'
  if (status === 'closed') return 'brand'
  return 'warning'
}

export function MeetingBreakoutPanel({
  meetingId,
  userId,
  meetingLiveKitRoomId,
  participants,
  canModerate,
  onClose,
  onOpenBreakouts,
  onCloseBreakouts,
  onJoinBreakoutRoom,
  fullWidth,
}: MeetingBreakoutPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const { rooms, loading, refresh, createRooms, autoAssign, setStatus } = useMeetingBreakouts({
    meetingId,
  })
  const [roomCount, setRoomCount] = useState('3')
  const [busy, setBusy] = useState(false)

  const assignableUserIds = useMemo(
    () => participants.map((p) => p.user_id).filter(Boolean),
    [participants],
  )

  const aggregateStatus = useMemo((): MeetingBreakoutRoom['status'] | null => {
    if (!rooms.length) return null
    if (rooms.every((r) => r.status === 'open')) return 'open'
    if (rooms.every((r) => r.status === 'closed')) return 'closed'
    return 'draft'
  }, [rooms])

  async function handleCreateAndAssign() {
    const count = Math.min(Math.max(parseInt(roomCount, 10) || 1, 1), 50)
    setBusy(true)
    try {
      const created = await createRooms({
        count,
        createdBy: userId,
        meetingLiveKitRoomId,
      })
      const ids = created.map((r) => r.id)
      if (assignableUserIds.length && ids.length) {
        await autoAssign({
          assignedBy: userId,
          userIds: assignableUserIds,
          breakoutIds: ids,
        })
      }
      toast.show('Breakout rooms ready', {
        tone: 'success',
        message: `${count} room${count === 1 ? '' : 's'} · ${assignableUserIds.length} assigned`,
      })
    } catch (err) {
      toast.show('Could not create breakouts', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleOpenAll() {
    setBusy(true)
    try {
      await setStatus('open')
      onOpenBreakouts?.()
      toast.show('Breakouts opened', { tone: 'success' })
    } catch (err) {
      toast.show('Could not open breakouts', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleCloseAll() {
    setBusy(true)
    try {
      await setStatus('closed')
      onCloseBreakouts?.()
      toast.show('Breakouts closed', { tone: 'success' })
    } catch (err) {
      toast.show('Could not close breakouts', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="Breakout rooms"
        subtitle={
          rooms.length
            ? `${rooms.length} room${rooms.length === 1 ? '' : 's'}`
            : undefined
        }
        icon={<Icons.LayoutGrid size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />

      <ScrollView flex={1} padding="$3">
        <YStack gap="$4">
          {aggregateStatus ? (
            <CoWorkStatusPill label={breakoutStatusLabel(aggregateStatus)} tone={breakoutStatusTone(aggregateStatus)} />
          ) : null}

          <XStack gap="$2" flexWrap="wrap">
            <Button
              tone="outline"
              size="$2"
              borderRadius={12}
              icon={<Icons.RefreshCw size={14} color={coworkUi.text} />}
              disabled={loading}
              onPress={() => void refresh()}
            >
              Refresh
            </Button>
          </XStack>

          {canModerate ? (
            <YStack
              gap="$3"
              padding="$3"
              borderRadius={14}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
              backgroundColor="rgba(255,255,255,0.03)"
            >
              <CoWorkSectionLabel>Host controls</CoWorkSectionLabel>
              <Field label="Number of rooms">
                <Input
                  value={roomCount}
                  onChangeText={setRoomCount}
                  keyboardType="number-pad"
                  placeholder="3"
                  backgroundColor="rgba(255,255,255,0.05)"
                  borderColor={coworkUi.borderSoft}
                  color={coworkUi.text}
                  borderRadius={14}
                />
              </Field>
              <Text fontSize={12} color={coworkUi.textMuted}>
                {assignableUserIds.length} admitted participant
                {assignableUserIds.length === 1 ? '' : 's'} will be auto-assigned evenly.
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                <Button
                  tone="primary"
                  size="$2"
                  borderRadius={12}
                  disabled={busy}
                  icon={busy ? <Spinner size="small" color="white" /> : <Icons.Plus size={14} color="white" />}
                  onPress={() => void handleCreateAndAssign()}
                >
                  Create & assign
                </Button>
                <Button
                  tone="outline"
                  size="$2"
                  borderRadius={12}
                  disabled={busy || !rooms.length}
                  onPress={() => void handleOpenAll()}
                >
                  Open all
                </Button>
                <Button
                  tone="outline"
                  size="$2"
                  borderRadius={12}
                  disabled={busy || !rooms.length}
                  onPress={() => void handleCloseAll()}
                >
                  Close all
                </Button>
              </XStack>
            </YStack>
          ) : null}

          {loading && rooms.length === 0 ? (
            <XStack justifyContent="center" paddingVertical="$6">
              <Spinner size="small" color={coworkUi.brandLight} />
            </XStack>
          ) : null}

          {!loading && rooms.length === 0 ? (
            <Text fontSize={14} color={coworkUi.textMuted} textAlign="center" paddingVertical="$4">
              {canModerate
                ? 'Create breakout rooms to split participants into smaller groups.'
                : 'No breakout rooms yet.'}
            </Text>
          ) : null}

          {rooms.map((room) => (
            <XStack
              key={room.id}
              alignItems="center"
              justifyContent="space-between"
              gap="$3"
              padding="$3"
              borderRadius={14}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
              backgroundColor={coworkUi.surfaceMuted}
            >
              <YStack flex={1} gap="$1">
                <Text fontSize={15} fontWeight="700" color={coworkUi.text}>
                  {room.title}
                </Text>
                <Text fontSize={12} color={coworkUi.textMuted}>
                  Room {room.room_number}
                </Text>
              </YStack>
              <YStack alignItems="flex-end" gap="$1.5">
                <CoWorkStatusPill
                  label={breakoutStatusLabel(room.status)}
                  tone={breakoutStatusTone(room.status)}
                />
                <XStack alignItems="center" gap="$1.5">
                  <Icons.Users size={14} color={coworkUi.textMuted} />
                  <Text fontSize={13} fontWeight="700" color={coworkUi.textSecondary}>
                    {room.assigneeIds.length}
                  </Text>
                </XStack>
                {room.status === 'open' &&
                room.livekit_room_name &&
                (room.assigneeIds.includes(userId) || canModerate) ? (
                  <Button
                    tone="primary"
                    size="$2"
                    borderRadius={999}
                    onPress={() => {
                      if (room.livekit_room_name) onJoinBreakoutRoom?.(room.livekit_room_name)
                      onClose()
                    }}
                  >
                    Join
                  </Button>
                ) : null}
              </YStack>
            </XStack>
          ))}
        </YStack>
      </ScrollView>
    </CoWorkPanelShell>
  )
}
