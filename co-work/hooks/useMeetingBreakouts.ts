import { useCallback, useEffect, useState } from 'react'

import {
  assignUserToBreakout,
  autoAssignMeetingBreakouts,
  createMeetingBreakouts,
  fetchMeetingBreakouts,
  setMeetingBreakoutsStatus,
  type MeetingBreakoutRoom,
  type MeetingBreakoutStatus,
} from '~/co-work/lib/meeting-breakouts'

type UseMeetingBreakoutsOptions = {
  meetingId: string
  enabled?: boolean
}

export function useMeetingBreakouts({ meetingId, enabled = true }: UseMeetingBreakoutsOptions) {
  const [rooms, setRooms] = useState<MeetingBreakoutRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!meetingId || !enabled) return
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchMeetingBreakouts(meetingId)
      setRooms(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load breakouts')
    } finally {
      setLoading(false)
    }
  }, [enabled, meetingId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createRooms = useCallback(
    async (input: { count: number; createdBy: string; meetingLiveKitRoomId: string }) => {
      const created = await createMeetingBreakouts({
        meetingId,
        createdBy: input.createdBy,
        count: input.count,
        meetingLiveKitRoomId: input.meetingLiveKitRoomId,
      })
      setRooms(created)
      await refresh()
      return created
    },
    [meetingId, refresh],
  )

  const autoAssign = useCallback(
    async (input: { assignedBy: string; userIds: string[]; breakoutIds: string[] }) => {
      await autoAssignMeetingBreakouts({
        meetingId,
        assignedBy: input.assignedBy,
        userIds: input.userIds,
        breakoutIds: input.breakoutIds,
      })
      await refresh()
    },
    [meetingId, refresh],
  )

  const setStatus = useCallback(
    async (status: MeetingBreakoutStatus) => {
      await setMeetingBreakoutsStatus(meetingId, status)
      await refresh()
    },
    [meetingId, refresh],
  )

  const assignUser = useCallback(
    async (input: { breakoutId: string; userId: string; assignedBy: string }) => {
      await assignUserToBreakout({
        meetingId,
        breakoutId: input.breakoutId,
        userId: input.userId,
        assignedBy: input.assignedBy,
      })
      await refresh()
    },
    [meetingId, refresh],
  )

  return {
    rooms,
    loading,
    error,
    refresh,
    createRooms,
    autoAssign,
    assignUser,
    setStatus,
  }
}
