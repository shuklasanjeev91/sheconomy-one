import { supabase } from '~/lib/supabase/client'

export type MeetingBreakoutStatus = 'draft' | 'open' | 'closed'

export type MeetingBreakoutRoom = {
  id: string
  meeting_id: string
  room_number: number
  title: string
  status: MeetingBreakoutStatus
  /** Breakout media room name (column name predates mediasoup; store builds still read it). */
  livekit_room_name: string | null
  created_by: string
  assigneeIds: string[]
}

export function breakoutMediaRoomName(meetingRoomId: string, breakoutId: string): string {
  return `${meetingRoomId}__bo__${breakoutId}`
}

export async function fetchMeetingBreakouts(meetingId: string): Promise<MeetingBreakoutRoom[]> {
  const { data: rooms, error } = await supabase
    .from('meeting_breakout_rooms')
    .select('id, meeting_id, room_number, title, status, livekit_room_name, created_by')
    .eq('meeting_id', meetingId)
    .order('room_number', { ascending: true })
  if (error) throw new Error(error.message)
  if (!rooms?.length) return []

  const { data: assignments, error: assignError } = await supabase
    .from('meeting_breakout_assignments')
    .select('breakout_id, user_id')
    .eq('meeting_id', meetingId)
  if (assignError) throw new Error(assignError.message)

  return rooms.map((room) => ({
    ...room,
    status: room.status as MeetingBreakoutStatus,
    assigneeIds: (assignments ?? [])
      .filter((row) => row.breakout_id === room.id)
      .map((row) => row.user_id),
  }))
}

export async function createMeetingBreakouts(input: {
  meetingId: string
  createdBy: string
  count: number
  meetingRoomId: string
}): Promise<MeetingBreakoutRoom[]> {
  const count = Math.min(Math.max(Math.floor(input.count), 1), 50)
  const rows = Array.from({ length: count }, (_, index) => ({
    meeting_id: input.meetingId,
    room_number: index + 1,
    title: `Breakout ${index + 1}`,
    status: 'draft' as const,
    created_by: input.createdBy,
  }))
  // Replace existing draft/closed rooms when recreating.
  await supabase.from('meeting_breakout_assignments').delete().eq('meeting_id', input.meetingId)
  await supabase.from('meeting_breakout_rooms').delete().eq('meeting_id', input.meetingId)

  const { data, error } = await supabase
    .from('meeting_breakout_rooms')
    .insert(rows)
    .select('id, meeting_id, room_number, title, status, livekit_room_name, created_by')
  if (error) throw new Error(error.message)

  const withNames = await Promise.all(
    (data ?? []).map(async (room) => {
      const livekit_room_name = breakoutMediaRoomName(input.meetingRoomId, room.id)
      await supabase
        .from('meeting_breakout_rooms')
        .update({ livekit_room_name })
        .eq('id', room.id)
      return {
        ...room,
        status: room.status as MeetingBreakoutStatus,
        livekit_room_name,
        assigneeIds: [] as string[],
      }
    }),
  )
  return withNames
}

export async function autoAssignMeetingBreakouts(input: {
  meetingId: string
  assignedBy: string
  userIds: string[]
  breakoutIds: string[]
}): Promise<void> {
  if (!input.breakoutIds.length) throw new Error('Create breakout rooms first.')
  await supabase.from('meeting_breakout_assignments').delete().eq('meeting_id', input.meetingId)
  const rows = input.userIds.map((userId, index) => ({
    meeting_id: input.meetingId,
    breakout_id: input.breakoutIds[index % input.breakoutIds.length],
    user_id: userId,
    assigned_by: input.assignedBy,
  }))
  if (!rows.length) return
  const { error } = await supabase.from('meeting_breakout_assignments').insert(rows)
  if (error) throw new Error(error.message)
}

export async function setMeetingBreakoutsStatus(
  meetingId: string,
  status: MeetingBreakoutStatus,
): Promise<void> {
  const { error } = await supabase
    .from('meeting_breakout_rooms')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('meeting_id', meetingId)
  if (error) throw new Error(error.message)
}

export async function assignUserToBreakout(input: {
  meetingId: string
  breakoutId: string
  userId: string
  assignedBy: string
}): Promise<void> {
  await supabase
    .from('meeting_breakout_assignments')
    .delete()
    .eq('meeting_id', input.meetingId)
    .eq('user_id', input.userId)
  const { error } = await supabase.from('meeting_breakout_assignments').insert({
    meeting_id: input.meetingId,
    breakout_id: input.breakoutId,
    user_id: input.userId,
    assigned_by: input.assignedBy,
  })
  if (error) throw new Error(error.message)
}
