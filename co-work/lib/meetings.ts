import { supabase } from '~/lib/supabase/client'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'

import { parseMeetingInvitees } from '~/co-work/lib/invites'
import type {
  CreateMeetingInput,
  Meeting,
  MeetingChatMessage,
  MeetingParticipant,
  MeetingSecuritySettings,
} from '~/co-work/lib/types'

const MEETING_SELECT =
  'id, title, description, meeting_code, host_id, status, scheduled_at, started_at, ended_at, time_zone, max_participants, room_id, security_settings, meeting_options, invitees, created_at, host:profiles!meetings_host_id_fkey(full_name, username, avatar_url)'

const PARTICIPANT_SELECT =
  'id, meeting_id, user_id, status, is_host, is_muted, is_video_off, joined_at, left_at, profile:profiles!meeting_participants_user_id_fkey(full_name, username, avatar_url)'

/** Keep meetings listed until 24h after the same anchor used for display time. */
export const MEETING_LIST_RETENTION_MS = 24 * 60 * 60 * 1000

type MeetingTimeFields = Pick<Meeting, 'scheduled_at' | 'started_at' | 'created_at'>

/** Same timestamp shown via formatWhen: scheduled → started → created. */
export function getMeetingAnchorAt(meeting: MeetingTimeFields): Date | null {
  const raw = meeting.scheduled_at ?? meeting.started_at ?? meeting.created_at
  if (!raw) return null
  const date = new Date(raw)
  return Number.isFinite(date.getTime()) ? date : null
}

export function getMeetingRetentionExpiresAt(meeting: MeetingTimeFields): Date | null {
  const anchor = getMeetingAnchorAt(meeting)
  if (!anchor) return null
  return new Date(anchor.getTime() + MEETING_LIST_RETENTION_MS)
}

export function isMeetingPastRetention(meeting: MeetingTimeFields, nowMs = Date.now()): boolean {
  const expiresAt = getMeetingRetentionExpiresAt(meeting)
  if (!expiresAt) return false
  return nowMs >= expiresAt.getTime()
}

export function filterMeetingsWithinRetention<T extends MeetingTimeFields>(
  meetings: T[],
  nowMs = Date.now(),
): T[] {
  return meetings.filter((meeting) => !isMeetingPastRetention(meeting, nowMs))
}

function parseJson<T>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null
  return value as T
}

function normalizeSecuritySettings(value: unknown): MeetingSecuritySettings | null {
  const raw = parseJson<Record<string, unknown>>(value)
  if (!raw) return null

  return {
    passcode: (raw.passcode as string | undefined) ?? undefined,
    requirePasscode: !!(raw.requirePasscode ?? raw.require_passcode),
    waitingRoom: !!(raw.waitingRoom ?? raw.waiting_room),
    muteOnJoin: !!(raw.muteOnJoin ?? raw.mute_on_join),
    videoOffOnJoin: !!(raw.videoOffOnJoin ?? raw.video_off_on_join),
    allowScreenShare: raw.allowScreenShare !== false && raw.allow_screen_share !== false,
    allowChat: raw.allowChat !== false && raw.allow_chat !== false,
    allowRecording: raw.allowRecording !== false && raw.allow_recording !== false,
    allowHandRaise: raw.allowHandRaise !== false && raw.allow_hand_raise !== false,
    authenticatedUsersOnly: !!(raw.authenticatedUsersOnly ?? raw.authenticated_users_only),
  }
}

function mapMeeting(row: Record<string, unknown>): Meeting {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    meeting_code: row.meeting_code as string,
    host_id: row.host_id as string,
    status: row.status as Meeting['status'],
    scheduled_at: (row.scheduled_at as string | null) ?? null,
    started_at: (row.started_at as string | null) ?? null,
    ended_at: (row.ended_at as string | null) ?? null,
    time_zone: (row.time_zone as string | null) ?? null,
    max_participants: (row.max_participants as number | null) ?? null,
    room_id: (row.room_id as string | null) ?? null,
    security_settings: normalizeSecuritySettings(row.security_settings),
    meeting_options: parseJson(row.meeting_options),
    created_at: (row.created_at as string | null) ?? null,
    is_recurring: (row.is_recurring as boolean | null) ?? null,
    repeat: (row.repeat as Meeting['repeat']) ?? null,
    invitees: parseMeetingInvitees(row.invitees),
    host: (row.host as Meeting['host']) ?? null,
  }
}

function mapParticipant(row: Record<string, unknown>): MeetingParticipant {
  return {
    id: row.id as string,
    meeting_id: row.meeting_id as string,
    user_id: row.user_id as string,
    status: row.status as MeetingParticipant['status'],
    is_host: (row.is_host as boolean | null) ?? null,
    is_muted: (row.is_muted as boolean | null) ?? null,
    is_video_off: (row.is_video_off as boolean | null) ?? null,
    joined_at: (row.joined_at as string | null) ?? null,
    left_at: (row.left_at as string | null) ?? null,
    profile: (row.profile as MeetingParticipant['profile']) ?? null,
  }
}

function randomAlphaCode(length: number, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return result
}

export async function generateMeetingCode(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_meeting_code')
  if (!error && typeof data === 'string' && data.trim()) {
    return data.trim().toUpperCase()
  }

  // Fallback when the RPC is unavailable — keep the usual 9-character room code shape.
  return `${randomAlphaCode(3)}${randomAlphaCode(3)}${randomAlphaCode(3)}`
}

function generateLiveKitRoomId(): string {
  return randomAlphaCode(6, 'abcdefghijklmnopqrstuvwxyz0123456789')
}

export async function ensureMeetingRoomId(meeting: Meeting): Promise<Meeting> {
  if (meeting.room_id) return meeting

  const { data: roomId, error } = await supabase.rpc('ensure_meeting_room_id_rpc', {
    meeting_id_input: meeting.id,
  })
  if (error) throw new Error(error.message)

  const { data, error: fetchError } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .eq('id', meeting.id)
    .single()

  if (fetchError) throw new Error(fetchError.message)
  return { ...mapMeeting(data as Record<string, unknown>), room_id: roomId as string }
}

export async function fetchHostedMeetings(userId: string): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .eq('host_id', userId)
    .in('status', ['scheduled', 'instant', 'active'])
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(50)

  if (error) throw new Error(error.message)
  const meetings = (data ?? []).map((row) => mapMeeting(row as Record<string, unknown>))
  // Expire first so retention filtering cannot skip the soft-delete write.
  await expireHostedMeetingsPastRetention(meetings, userId)
  return filterMeetingsWithinRetention(meetings)
}

/** Meetings the user hosts or is invited to as a participant. */
export function mergeHostedAndInvitedMeetings(
  hosted: Meeting[],
  invited: Meeting[],
): Meeting[] {
  const hostedIds = new Set(hosted.map((meeting) => meeting.id))
  const merged = [...hosted, ...invited.filter((meeting) => !hostedIds.has(meeting.id))]
  merged.sort((a, b) => {
    const aAt = a.scheduled_at ? Date.parse(a.scheduled_at) : Number.MAX_SAFE_INTEGER
    const bAt = b.scheduled_at ? Date.parse(b.scheduled_at) : Number.MAX_SAFE_INTEGER
    return aAt - bAt
  })
  return merged
}

export async function fetchMyMeetings(userId: string): Promise<Meeting[]> {
  // Hosted path already expires + filters meetings past the 24h retention window.
  const hosted = await fetchHostedMeetings(userId)

  const { data: participantRows, error } = await supabase
    .from('meeting_participants')
    .select('meeting_id')
    .eq('user_id', userId)
    .limit(50)

  if (error) {
    return hosted
  }

  const invitedIds = (participantRows ?? [])
    .map((row) => row.meeting_id)
    .filter((id) => !hosted.some((meeting) => meeting.id === id))

  if (!invitedIds.length) return hosted

  const { data: invitedMeetings } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .in('id', invitedIds)
    .in('status', ['scheduled', 'instant', 'active'])
    .order('scheduled_at', { ascending: true, nullsFirst: false })

  const invited = filterMeetingsWithinRetention(
    (invitedMeetings ?? []).map((row) => mapMeeting(row as Record<string, unknown>)),
  )
  return mergeHostedAndInvitedMeetings(hosted, invited)
}

export async function fetchUpcomingMeetings(): Promise<Meeting[]> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .in('status', ['scheduled', 'instant', 'active'])
    .gte('scheduled_at', now) // Only get meetings scheduled for now or in the future
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(30)

  if (error) throw new Error(error.message)
  return filterMeetingsWithinRetention(
    (data ?? []).map((row) => mapMeeting(row as Record<string, unknown>)),
  )
}

export async function fetchMeetingByCode(code: string): Promise<Meeting | null> {
  const normalized = code.trim().toUpperCase()
  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .eq('meeting_code', normalized)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  const meeting = mapMeeting(data as Record<string, unknown>)
  if (!meeting.room_id) return ensureMeetingRoomId(meeting)
  return meeting
}

/** Title / code / description search for omnibox + `/search`. */
export async function searchMeetings(query: string, limit = 12): Promise<Meeting[]> {
  const term = query.trim().replace(/[%*,]/g, '')
  if (!term) return []

  const codeGuess = term.toUpperCase().replace(/\s+/g, '')
  if (/^[A-Z0-9]{4,12}$/.test(codeGuess)) {
    const exact = await fetchMeetingByCode(codeGuess)
    if (exact) return [exact]
  }

  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .or(`title.ilike.%${term}%,meeting_code.ilike.%${term}%,description.ilike.%${term}%`)
    .in('status', ['scheduled', 'instant', 'active'])
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return filterMeetingsWithinRetention(
    (data ?? []).map((row) => mapMeeting(row as Record<string, unknown>)),
  )
}

export async function createMeeting(hostId: string, input: CreateMeetingInput): Promise<Meeting> {
  const meetingCode = await generateMeetingCode()
  const roomId = generateLiveKitRoomId()
  const now = new Date().toISOString()
  const status = input.startNow ? 'instant' : 'scheduled'

  const security = input.securitySettings ?? {}
  const options = input.meetingOptions ?? {}
  const passcode = security.passcode?.trim()
  const securitySettings = {
    waitingRoom: security.waitingRoom ?? false,
    waiting_room: security.waitingRoom ?? false,
    muteOnJoin: security.muteOnJoin ?? false,
    videoOffOnJoin: security.videoOffOnJoin ?? false,
    allowScreenShare: security.allowScreenShare !== false,
    allowChat: security.allowChat !== false,
    allowRecording: security.allowRecording !== false,
    allowHandRaise: security.allowHandRaise !== false,
    authenticated_users_only: security.authenticatedUsersOnly ?? false,
    ...(passcode
      ? {
        passcode,
        requirePasscode: true,
        require_passcode: true,
      }
      : {
        requirePasscode: security.requirePasscode ?? false,
      }),
  }

  const meetingOptions = {
    layout: options.layout ?? 'grid',
    defaultVideo: options.defaultVideo ?? true,
    defaultAudio: options.defaultAudio ?? true,
    enableMeetingChat: options.enableMeetingChat !== false && security.allowChat !== false,
    host_video_on: options.defaultVideo ?? true,
    participant_video_on: options.defaultVideo ?? true,
    allowJoinBeforeHost: options.allowJoinBeforeHost ?? false,
    allow_join_before_host: options.allowJoinBeforeHost ?? false,
    auto_record: options.autoRecord ?? false,
    time_zone: input.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  }

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      host_id: hostId,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      meeting_code: meetingCode,
      room_id: roomId,
      status,
      scheduled_at: input.scheduledAt ?? (input.startNow ? now : null),
      started_at: input.startNow ? now : null,
      time_zone: input.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      max_participants: input.maxParticipants ?? 100,
      is_recurring: input.isRecurring ?? false,
      repeat: input.repeat ?? null,
      invitees: input.invitees?.map((invitee) => ({
        ...invitee,
        invited_at: invitee.invited_at ?? now,
        status: invitee.status ?? 'pending',
      })) ?? [],
      security_settings: securitySettings,
      meeting_options: meetingOptions,
    })
    .select(MEETING_SELECT)
    .single()

  if (error) throw new Error(error.message)

  const meeting = mapMeeting(data as Record<string, unknown>)

  await supabase.from('meeting_rooms').insert({
    meeting_id: meeting.id,
    host_id: hostId,
    room_code: roomId,
    is_active: input.startNow ?? false,
    activated_at: input.startNow ? now : null,
    max_participants: input.maxParticipants ?? 100,
  })

  invalidateCache(INVALIDATION_TOPICS.coWorkMeetings)

  return meeting
}

export async function startMeeting(meetingId: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('meetings')
    .update({ status: 'active', started_at: now })
    .eq('id', meetingId)

  if (error) throw new Error(error.message)

  await supabase
    .from('meeting_rooms')
    .update({ is_active: true, activated_at: now })
    .eq('meeting_id', meetingId)
}

export async function endMeeting(meetingId: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('meetings')
    .update({ status: 'ended', ended_at: now })
    .eq('id', meetingId)

  if (error) throw new Error(error.message)

  await supabase
    .from('meeting_rooms')
    .update({ is_active: false, ended_at: now })
    .eq('meeting_id', meetingId)

  await supabase
    .from('meeting_participants')
    .update({ status: 'left', left_at: now })
    .eq('meeting_id', meetingId)
    .eq('status', 'admitted')
}

/** Soft-delete hosted meetings that are past the 24h retention window. */
export async function expireHostedMeetingsPastRetention(
  meetings: Meeting[],
  hostUserId: string,
  nowMs = Date.now(),
): Promise<void> {
  const expiredHosted = meetings.filter(
    (meeting) => meeting.host_id === hostUserId && isMeetingPastRetention(meeting, nowMs),
  )
  if (!expiredHosted.length) return

  await Promise.all(
    expiredHosted.map(async (meeting) => {
      try {
        await endMeeting(meeting.id)
      } catch {
        // Best-effort: list filtering still hides expired rows if persist fails.
      }
    }),
  )
}

export async function verifyMeetingPasscode(meetingId: string, passcode: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_meeting_passcode', {
    meeting_id_input: meetingId,
    passcode_input: passcode,
  })
  if (error) throw new Error(error.message)
  return !!data
}

export async function joinMeetingParticipant(
  meetingId: string,
  userId: string,
  isHost: boolean,
  waitingRoom: boolean,
): Promise<MeetingParticipant> {
  const { data: existing } = await supabase
    .from('meeting_participants')
    .select('id, status')
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
    .maybeSingle()

  // Stay admitted across reconnects. Rejected guests may request again.
  const keepAdmitted = existing?.status === 'admitted' || isHost
  const status = keepAdmitted ? 'admitted' : waitingRoom ? 'waiting' : 'admitted'
  const joinedAt = status === 'waiting' ? null : new Date().toISOString()

  const { data, error } = await supabase
    .from('meeting_participants')
    .upsert(
      {
        meeting_id: meetingId,
        user_id: userId,
        is_host: isHost,
        status,
        joined_at: joinedAt,
        left_at: null,
        is_muted: false,
        is_video_off: false,
      },
      { onConflict: 'meeting_id,user_id' },
    )
    .select(PARTICIPANT_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapParticipant(data as Record<string, unknown>)
}

async function reviewerId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function admitParticipant(participantId: string): Promise<void> {
  const reviewedBy = await reviewerId()
  const { error } = await supabase
    .from('meeting_participants')
    .update({
      status: 'admitted',
      joined_at: new Date().toISOString(),
      left_at: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    })
    .eq('id', participantId)

  if (error) throw new Error(error.message)
}

export async function rejectParticipant(participantId: string): Promise<void> {
  const reviewedBy = await reviewerId()
  const { error } = await supabase
    .from('meeting_participants')
    .update({
      status: 'rejected',
      left_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    })
    .eq('id', participantId)

  if (error) throw new Error(error.message)
}

export async function cancelMeeting(meetingId: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('meetings')
    .update({ status: 'cancelled', ended_at: now })
    .eq('id', meetingId)

  if (error) throw new Error(error.message)

  await supabase
    .from('meeting_rooms')
    .update({ is_active: false, ended_at: now })
    .eq('meeting_id', meetingId)

  invalidateCache(INVALIDATION_TOPICS.coWorkMeetings)
}

export async function leaveMeetingParticipant(meetingId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('meeting_participants')
    .update({ status: 'left', left_at: new Date().toISOString() })
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function updateParticipantMedia(
  meetingId: string,
  userId: string,
  patch: { is_muted?: boolean; is_video_off?: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('meeting_participants')
    .update(patch)
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function fetchMeetingParticipants(meetingId: string): Promise<MeetingParticipant[]> {
  const { data, error } = await supabase
    .from('meeting_participants')
    .select(PARTICIPANT_SELECT)
    .eq('meeting_id', meetingId)
    .in('status', ['admitted', 'waiting', 'rejected'])
    .order('joined_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapParticipant(row as Record<string, unknown>))
}

export async function fetchMeetingChat(meetingId: string): Promise<MeetingChatMessage[]> {
  const { data, error } = await supabase
    .from('meeting_chat_messages')
    .select('id, meeting_id, sender_id, message_text, message_type, created_at')
    .eq('meeting_id', meetingId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const senderIds = [...new Set(rows.map((r) => r.sender_id))]
  let profiles: Record<string, { full_name: string | null; username: string | null; avatar_url: string | null }> = {}

  if (senderIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', senderIds)
    profiles = Object.fromEntries((profileRows ?? []).map((p) => [p.id, p]))
  }

  return rows.map((row) => ({
    ...row,
    sender: profiles[row.sender_id] ?? null,
  })) as MeetingChatMessage[]
}

export async function sendMeetingChatMessage(
  meetingId: string,
  senderId: string,
  message: string,
): Promise<MeetingChatMessage> {
  const { data, error } = await supabase
    .from('meeting_chat_messages')
    .insert({
      meeting_id: meetingId,
      sender_id: senderId,
      message_text: message.trim(),
      message_type: 'text',
    })
    .select('id, meeting_id, sender_id, message_text, message_type, created_at')
    .single()

  if (error) throw new Error(error.message)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, avatar_url')
    .eq('id', senderId)
    .maybeSingle()

  return {
    ...(data as MeetingChatMessage),
    sender: profile ?? null,
  }
}

export { getMeetingShareUrl } from '~/lib/share/urls'

export function formatMeetingCode(code: string): string {
  const clean = code.replace(/\s/g, '').toUpperCase()
  if (clean.length <= 3) return clean
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`.trim()
}
