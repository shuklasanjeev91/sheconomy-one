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
import { assignParticipantsToTopics } from '~/co-work/lib/meeting-studio'
import type { MeetingBreakoutRoom } from '~/co-work/lib/meeting-breakouts'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type BreakoutParticipant = {
  user_id: string
  display_name?: string
}

type MeetingBreakoutPanelProps = {
  meetingId: string
  userId: string
  meetingRoomId: string
  participants: BreakoutParticipant[]
  canModerate: boolean
  onClose: () => void
  onOpenBreakouts?: () => void
  onCloseBreakouts?: () => void
  onJoinBreakoutRoom?: (mediaRoomName: string) => void
  /** Host broadcast message into open breakouts (chat notice). */
  onBroadcastToBreakouts?: (message: string) => void
  /** Host sets breakout end timestamp (ms) for participant countdown. */
  onBreakoutTimerSet?: (endsAt: number | null) => void
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
  meetingRoomId,
  participants,
  canModerate,
  onClose,
  onOpenBreakouts,
  onCloseBreakouts,
  onJoinBreakoutRoom,
  onBroadcastToBreakouts,
  onBreakoutTimerSet,
  fullWidth,
}: MeetingBreakoutPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const { rooms, loading, refresh, createRooms, autoAssign, assignUser, setStatus } =
    useMeetingBreakouts({
      meetingId,
    })
  const [roomCount, setRoomCount] = useState('3')
  const [topics, setTopics] = useState('Pricing, Product')
  const [timerMinutes, setTimerMinutes] = useState('10')
  const [broadcastText, setBroadcastText] = useState('')
  const [moveUserId, setMoveUserId] = useState('')
  const [moveRoomId, setMoveRoomId] = useState('')
  const [busy, setBusy] = useState(false)
  const [endsAt, setEndsAt] = useState<number | null>(null)

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
        meetingRoomId,
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

  async function handleAssignByTopic() {
    const topicNames = topics.split(',').map((topic) => topic.trim()).filter(Boolean).slice(0, 20)
    if (topicNames.length < 2) {
      toast.show('Add at least two topics, separated by commas', { tone: 'info' })
      return
    }
    setBusy(true)
    try {
      const created = await createRooms({
        count: topicNames.length,
        createdBy: userId,
        meetingRoomId,
      })
      const grouped = assignParticipantsToTopics({
        participants: assignableUserIds.map((id, index) => ({
          userId: id,
          topic: topicNames[index % topicNames.length] ?? topicNames[0] ?? '',
        })),
        topics: topicNames,
      })
      for (const [index, group] of grouped.entries()) {
        const room = created[index]
        if (!room) continue
        for (const memberId of group.userIds) {
          await assignUser({ breakoutId: room.id, userId: memberId, assignedBy: userId })
        }
      }
      toast.show('Assigned by topic', {
        tone: 'success',
        message: topicNames.join(' · '),
      })
    } catch (err) {
      toast.show('Could not assign by topic', {
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
      const minutes = Math.min(Math.max(parseInt(timerMinutes, 10) || 0, 0), 180)
      const nextEndsAt = minutes > 0 ? Date.now() + minutes * 60_000 : null
      setEndsAt(nextEndsAt)
      onBreakoutTimerSet?.(nextEndsAt)
      onOpenBreakouts?.()
      toast.show('Breakouts opened', {
        tone: 'success',
        message: minutes > 0 ? `Timer set for ${minutes} min` : undefined,
      })
    } catch (err) {
      toast.show('Could not open breakouts', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleManualAssign() {
    if (!moveUserId || !moveRoomId) {
      toast.show('Pick a participant and a room', { tone: 'info' })
      return
    }
    setBusy(true)
    try {
      await assignUser({
        breakoutId: moveRoomId,
        userId: moveUserId,
        assignedBy: userId,
      })
      toast.show('Participant moved', { tone: 'success' })
      setMoveUserId('')
    } catch (err) {
      toast.show('Could not move participant', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  function handleBroadcast() {
    const message = broadcastText.trim()
    if (!message) {
      toast.show('Enter a broadcast message', { tone: 'info' })
      return
    }
    onBroadcastToBreakouts?.(message)
    setBroadcastText('')
    toast.show('Broadcast sent', { tone: 'success' })
  }

  const remainingLabel =
    endsAt && endsAt > Date.now()
      ? `${Math.max(1, Math.ceil((endsAt - Date.now()) / 60_000))} min left`
      : null

  async function handleCloseAll() {
    setBusy(true)
    try {
      await setStatus('closed')
      setEndsAt(null)
      onBreakoutTimerSet?.(null)
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
              backgroundColor={coworkUi.surfaceMuted}
            >
              <CoWorkSectionLabel>Host controls</CoWorkSectionLabel>
              <Field label="Number of rooms">
                <Input
                  value={roomCount}
                  onChangeText={setRoomCount}
                  keyboardType="number-pad"
                  placeholder="3"
                  backgroundColor={coworkUi.surface}
                  borderColor={coworkUi.borderSoft}
                  color={coworkUi.text}
                  borderRadius={14}
                />
              </Field>
              <Field label="Topics">
                <Input
                  value={topics}
                  onChangeText={setTopics}
                  placeholder="Pricing, Product"
                  backgroundColor={coworkUi.surface}
                  borderColor={coworkUi.borderSoft}
                  color={coworkUi.text}
                  borderRadius={14}
                />
              </Field>
              <Field label="Timer (minutes, optional)">
                <Input
                  value={timerMinutes}
                  onChangeText={setTimerMinutes}
                  keyboardType="number-pad"
                  placeholder="10"
                  backgroundColor={coworkUi.surface}
                  borderColor={coworkUi.borderSoft}
                  color={coworkUi.text}
                  borderRadius={14}
                />
              </Field>
              {remainingLabel ? (
                <Text fontSize={12} color={coworkUi.brandLight} fontWeight="700">
                  {remainingLabel}
                </Text>
              ) : null}
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
                  disabled={busy}
                  onPress={() => void handleAssignByTopic()}
                >
                  Assign by topic
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

              {rooms.length ? (
                <YStack gap="$2" paddingTop="$2">
                  <CoWorkSectionLabel>Manual assign</CoWorkSectionLabel>
                  <Text fontSize={12} color={coworkUi.textMuted}>
                    Tap a participant, then a room.
                  </Text>
                  <XStack gap="$2" flexWrap="wrap">
                    {participants.map((participant) => (
                      <Button
                        key={participant.user_id}
                        tone={moveUserId === participant.user_id ? 'primary' : 'outline'}
                        size="$2"
                        borderRadius={999}
                        onPress={() => setMoveUserId(participant.user_id)}
                      >
                        {participant.display_name || participant.user_id.slice(0, 8)}
                      </Button>
                    ))}
                  </XStack>
                  <XStack gap="$2" flexWrap="wrap">
                    {rooms.map((room) => (
                      <Button
                        key={room.id}
                        tone={moveRoomId === room.id ? 'primary' : 'outline'}
                        size="$2"
                        borderRadius={999}
                        onPress={() => setMoveRoomId(room.id)}
                      >
                        {room.title}
                      </Button>
                    ))}
                  </XStack>
                  <Button
                    tone="outline"
                    size="$2"
                    borderRadius={12}
                    disabled={busy}
                    onPress={() => void handleManualAssign()}
                  >
                    Move to selected room
                  </Button>
                  <Field label="Broadcast to breakouts">
                    <Input
                      value={broadcastText}
                      onChangeText={setBroadcastText}
                      placeholder="Return to the main room in 2 minutes…"
                      backgroundColor={coworkUi.surface}
                      borderColor={coworkUi.borderSoft}
                      color={coworkUi.text}
                      borderRadius={14}
                    />
                  </Field>
                  <Button
                    tone="outline"
                    size="$2"
                    borderRadius={12}
                    disabled={!onBroadcastToBreakouts}
                    onPress={handleBroadcast}
                  >
                    Broadcast
                  </Button>
                </YStack>
              ) : null}
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
