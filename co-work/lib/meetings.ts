import { supabase } from '~/lib/supabase/client'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { assertUtcIso, isValidIanaTimeZone, normalizeIanaTimeZone, resolveDeviceIanaTimeZone } from '~/lib/calendar/timezone'

import { parseMeetingInvitees } from '~/co-work/lib/invites'
import { normalizeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'
import { mapMeetingSecurityJoinError } from '~/co-work/lib/meeting-security'
import type {
  CreateMeetingInput,
  Meeting,
  MeetingChatMessage,
  MeetingControlEvent,
  MeetingModerationSettings,
  MeetingParticipant,
  MeetingRole,
  MeetingSecuritySettings,
} from '~/co-work/lib/types'

const MEETING_SELECT =
  'id, title, description, meeting_code, host_id, status, scheduled_at, scheduled_end_at, started_at, ended_at, time_zone, max_participants, room_id, security_settings, meeting_options, invitees, is_recurring, repeat, created_at, host:profiles!meetings_host_id_fkey(full_name, username, avatar_url)'

const PARTICIPANT_SELECT =
  'id, meeting_id, user_id, display_name, status, is_host, is_muted, is_video_off, joined_at, left_at, profile:profiles!meeting_participants_user_id_fkey(full_name, username, avatar_url)'

type MeetingTimeFields = Pick<Meeting, 'scheduled_at' | 'started_at' | 'created_at'>

export function createMeetingSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

/** Same timestamp shown via formatWhen: scheduled → started → created. */
export function getMeetingAnchorAt(meeting: MeetingTimeFields): Date | null {
  const raw = meeting.scheduled_at ?? meeting.started_at ?? meeting.created_at
  if (!raw) return null
  const date = new Date(raw)
  return Number.isFinite(date.getTime()) ? date : null
}

/**
 * Zoom-style availability: a meeting stays open to the host and participants
 * past its scheduled time and past a first `ended`, because the host can always
 * restart it. Cancelling is the only thing that closes it for good.
 */
export function isMeetingJoinable(meeting: Pick<Meeting, 'status'>): boolean {
  return meeting.status !== 'cancelled'
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
    allowPrivateChat: raw.allowPrivateChat !== false && raw.allow_private_chat !== false,
    allowRecording: raw.allowRecording !== false && raw.allow_recording !== false,
    allowHandRaise: raw.allowHandRaise !== false && raw.allow_hand_raise !== false,
    authenticatedUsersOnly: !!(raw.authenticatedUsersOnly ?? raw.authenticated_users_only),
  }
}

function normalizeMeetingOptions(value: unknown): Meeting['meeting_options'] {
  const raw = parseJson<Record<string, unknown>>(value)
  if (!raw) return null

  const autoRecord = !!(raw.autoRecord ?? raw.auto_record)
  const captionsEnabled = !!(raw.captionsEnabled ?? raw.captions_enabled)
  const recordingModeRaw = (raw.recordingMode ?? raw.recording_mode) as string | undefined
  const recordingMode =
    recordingModeRaw === 'disabled' || recordingModeRaw === 'manual' || recordingModeRaw === 'automatic'
      ? recordingModeRaw
      : autoRecord
        ? 'automatic'
        : 'manual'

  return {
    layout: raw.layout === 'speaker' ? 'speaker' : 'grid',
    defaultVideo: raw.defaultVideo !== false && raw.host_video_on !== false,
    defaultAudio: raw.defaultAudio !== false,
    allowJoinBeforeHost: !!(raw.allowJoinBeforeHost ?? raw.allow_join_before_host),
    autoRecord,
    recordingMode,
    captionsEnabled,
    enableMeetingChat: raw.enableMeetingChat !== false,
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
    scheduled_end_at: (row.scheduled_end_at as string | null) ?? null,
    started_at: (row.started_at as string | null) ?? null,
    ended_at: (row.ended_at as string | null) ?? null,
    time_zone: (row.time_zone as string | null) ?? null,
    max_participants: (row.max_participants as number | null) ?? null,
    room_id: (row.room_id as string | null) ?? null,
    security_settings: normalizeSecuritySettings(row.security_settings),
    meeting_options: normalizeMeetingOptions(row.meeting_options),
    created_at: (row.created_at as string | null) ?? null,
    is_recurring: (row.is_recurring as boolean | null) ?? null,
    repeat: (row.repeat as Meeting['repeat']) ?? null,
    invitees: parseMeetingInvitees(row.invitees),
    host: (row.host as Meeting['host']) ?? null,
  }
}

function mapParticipant(row: Record<string, unknown>): MeetingParticipant {
  const role =
    (row.role as MeetingRole | undefined) ??
    ((row.is_host ? 'host' : 'participant') as MeetingRole)
  return {
    id: row.id as string,
    meeting_id: row.meeting_id as string,
    user_id: row.user_id as string,
    display_name: (row.display_name as string | null) ?? null,
    status: row.status as MeetingParticipant['status'],
    is_host: role === 'host' ? true : ((row.is_host as boolean | null) ?? null),
    is_muted: (row.is_muted as boolean | null) ?? null,
    is_video_off: (row.is_video_off as boolean | null) ?? null,
    joined_at: (row.joined_at as string | null) ?? null,
    left_at: (row.left_at as string | null) ?? null,
    role,
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

/** Listed statuses — everything except `cancelled`, which the host closed. */
const LISTED_MEETING_STATUSES = ['scheduled', 'instant', 'active', 'ended'] as const

export async function fetchHostedMeetings(userId: string): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .eq('host_id', userId)
    .in('status', LISTED_MEETING_STATUSES)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapMeeting(row as Record<string, unknown>))
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
    .in('status', LISTED_MEETING_STATUSES)
    .order('scheduled_at', { ascending: true, nullsFirst: false })

  const invited = (invitedMeetings ?? []).map((row) => mapMeeting(row as Record<string, unknown>))
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
  return (data ?? []).map((row) => mapMeeting(row as Record<string, unknown>))
}

/** Strip separators so `ABC-DEF-GHI`, `abc def ghi` and `ABCDEFGHI` compare equal. */
export function normalizeMeetingCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

/**
 * Codes are persisted in two shapes — older rows use `ABC-DEF-GHI`, newer ones
 * `ABCDEFGHI` — while recent-code chips and typed input arrive stripped. Match
 * every shape so a dashed meeting still resolves from a plain code.
 */
export function meetingCodeVariants(code: string): string[] {
  const plain = normalizeMeetingCode(code)
  if (!plain) return []

  const variants = new Set<string>([plain])
  const asTyped = code.trim().toUpperCase()
  if (asTyped) variants.add(asTyped)
  if (plain.length === 9) {
    variants.add(`${plain.slice(0, 3)}-${plain.slice(3, 6)}-${plain.slice(6)}`)
  }
  return [...variants]
}

export async function fetchMeetingByCode(code: string): Promise<Meeting | null> {
  const candidates = meetingCodeVariants(code)
  if (!candidates.length) return null

  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .in('meeting_code', candidates)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  const row = data?.[0]
  if (!row) return null
  const meeting = mapMeeting(row as Record<string, unknown>)
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
    .in('status', LISTED_MEETING_STATUSES)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapMeeting(row as Record<string, unknown>))
}

export async function createMeeting(hostId: string, input: CreateMeetingInput): Promise<Meeting> {
  const meetingCode = await generateMeetingCode()
  const roomId = generateLiveKitRoomId()
  const now = new Date().toISOString()
  const status = input.startNow ? 'instant' : 'scheduled'
  const timeZone = normalizeIanaTimeZone(input.timeZone?.trim() || resolveDeviceIanaTimeZone())
  if (!isValidIanaTimeZone(timeZone)) throw new Error('A valid IANA timezone is required')
  const scheduledAt = assertUtcIso(input.scheduledAt ?? (input.startNow ? now : ''), 'Start time')
  const scheduledEndAt = assertUtcIso(
    input.scheduledEndAt ?? new Date(Date.parse(scheduledAt) + 60 * 60 * 1000).toISOString(),
    'End time',
  )
  if (Date.parse(scheduledEndAt) <= Date.parse(scheduledAt)) {
    throw new Error('End time must be after the start time')
  }

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
    allowPrivateChat: security.allowPrivateChat !== false && security.allowChat !== false,
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

  const autoRecord = options.autoRecord ?? false
  const captionsEnabled = options.captionsEnabled ?? false
  const recordingMode = options.recordingMode ?? (autoRecord ? 'automatic' : 'manual')
  const meetingOptions = {
    layout: options.layout ?? 'grid',
    defaultVideo: options.defaultVideo ?? true,
    defaultAudio: options.defaultAudio ?? true,
    enableMeetingChat: options.enableMeetingChat !== false && security.allowChat !== false,
    host_video_on: options.defaultVideo ?? true,
    participant_video_on: options.defaultVideo ?? true,
    allowJoinBeforeHost: options.allowJoinBeforeHost ?? false,
    allow_join_before_host: options.allowJoinBeforeHost ?? false,
    autoRecord,
    auto_record: autoRecord,
    recordingMode,
    recording_mode: recordingMode,
    captionsEnabled,
    captions_enabled: captionsEnabled,
    time_zone: timeZone,
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
      scheduled_at: scheduledAt,
      scheduled_end_at: scheduledEndAt,
      started_at: input.startNow ? now : null,
      time_zone: timeZone,
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

  invalidateCache(INVALIDATION_TOPICS.coWorkMeetings)

  return meeting
}

export async function startMeeting(meetingId: string): Promise<void> {
  const { error } = await supabase.rpc('start_meeting_secure', { meeting_id_input: meetingId })
  if (error) throw new Error(error.message)
}

export async function endMeeting(meetingId: string): Promise<void> {
  const { error } = await supabase.rpc('end_meeting_secure', { meeting_id_input: meetingId })
  if (error) throw new Error(error.message)
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
  _userId: string,
  _isHost: boolean,
  _waitingRoom: boolean,
  sessionId: string,
  displayName: string,
): Promise<MeetingParticipant> {
  const cleanedDisplayName = normalizeMeetingDisplayName(displayName)
  if (!cleanedDisplayName) throw new Error('Enter a valid display name before joining.')
  const { data, error } = await supabase.rpc('join_meeting_participant', {
    meeting_id_input: meetingId,
    session_id_input: sessionId,
  })

  if (error) {
    const mapped = mapMeetingSecurityJoinError(error.message)
    throw new Error(mapped ?? error.message)
  }
  const { error: displayNameError } = await supabase.rpc(
    'set_meeting_participant_display_name',
    {
      meeting_id_input: meetingId,
      session_id_input: sessionId,
      display_name_input: cleanedDisplayName,
    },
  )
  if (displayNameError) throw new Error(displayNameError.message)
  return mapParticipant({
    ...(data as Record<string, unknown>),
    display_name: cleanedDisplayName,
  })
}

export async function admitParticipant(participantId: string): Promise<void> {
  const { error } = await supabase.rpc('review_meeting_participant', {
    participant_id_input: participantId,
    decision_input: 'admit',
  })
  if (error) {
    const mapped = mapMeetingSecurityJoinError(error.message)
    throw new Error(mapped ?? error.message)
  }
}

export async function rejectParticipant(participantId: string): Promise<void> {
  const { error } = await supabase.rpc('review_meeting_participant', {
    participant_id_input: participantId,
    decision_input: 'reject',
  })
  if (error) throw new Error(error.message)
}

export async function removeMeetingParticipant(
  meetingId: string,
  targetUserId: string,
): Promise<void> {
  const { error } = await supabase.rpc('moderate_meeting_participants', {
    meeting_id_input: meetingId,
    action_input: 'remove',
    target_user_id_input: targetUserId,
  })
  if (error) throw new Error(error.message)
}

export async function allowMeetingParticipantRejoin(participantId: string): Promise<void> {
  const { error } = await supabase.rpc('review_meeting_participant', {
    participant_id_input: participantId,
    decision_input: 'allow_rejoin',
  })
  if (error) throw new Error(error.message)
}

export async function cancelMeeting(meetingId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_meeting_secure', {
    meeting_id_input: meetingId,
  })
  if (error) throw new Error(error.message)

  invalidateCache(INVALIDATION_TOPICS.coWorkMeetings)
}

export async function leaveMeetingParticipant(
  meetingId: string,
  _userId: string,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase.rpc('leave_meeting_participant', {
    meeting_id_input: meetingId,
    session_id_input: sessionId,
  })

  if (error) throw new Error(error.message)
}

export async function updateParticipantMedia(
  meetingId: string,
  _userId: string,
  patch: { is_muted?: boolean; is_video_off?: boolean },
  sessionId: string,
): Promise<void> {
  const { error } = await supabase.rpc('update_meeting_participant_media', {
    meeting_id_input: meetingId,
    session_id_input: sessionId,
    is_muted_input: patch.is_muted ?? null,
    is_video_off_input: patch.is_video_off ?? null,
  })

  if (error) throw new Error(error.message)
}

export async function fetchMeetingParticipants(meetingId: string): Promise<MeetingParticipant[]> {
  const [{ data, error }, { data: roleRows, error: roleError }] = await Promise.all([
    supabase
      .from('meeting_participants')
      .select(PARTICIPANT_SELECT)
      .eq('meeting_id', meetingId)
      .in('status', ['admitted', 'waiting', 'rejected', 'removed'])
      .order('joined_at', { ascending: true }),
    supabase.from('meeting_roles').select('user_id, role').eq('meeting_id', meetingId),
  ])

  if (error) throw new Error(error.message)
  if (roleError) throw new Error(roleError.message)
  const roles = Object.fromEntries((roleRows ?? []).map((row) => [row.user_id, row.role]))
  return (data ?? []).map((row) =>
    mapParticipant({ ...(row as Record<string, unknown>), role: roles[row.user_id] }),
  )
}

export async function setMeetingLocked(meetingId: string, locked: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_meeting_locked', {
    meeting_id_input: meetingId,
    locked_input: locked,
  })
  if (error) throw new Error(error.message)
}

export async function fetchMeetingById(meetingId: string): Promise<Meeting | null> {
  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .eq('id', meetingId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapMeeting(data as Record<string, unknown>) : null
}

export async function fetchMeetingModerationSettings(
  meetingId: string,
): Promise<MeetingModerationSettings | null> {
  const { data, error } = await supabase
    .from('meeting_moderation_settings')
    .select('meeting_id, is_locked, host_leave_behavior')
    .eq('meeting_id', meetingId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as MeetingModerationSettings | null
}

export async function setMeetingHostLeaveBehavior(
  meetingId: string,
  behavior: MeetingModerationSettings['host_leave_behavior'],
): Promise<void> {
  const { error } = await supabase.rpc('set_meeting_host_leave_behavior', {
    meeting_id_input: meetingId,
    behavior_input: behavior,
  })
  if (error) throw new Error(error.message)
}

export async function assignMeetingCoHost(meetingId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_meeting_co_host', {
    meeting_id_input: meetingId,
    target_user_id_input: userId,
  })
  if (error) throw new Error(error.message)
}

export async function removeMeetingCoHost(meetingId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_meeting_co_host', {
    meeting_id_input: meetingId,
    target_user_id_input: userId,
  })
  if (error) throw new Error(error.message)
}

export async function transferMeetingHost(meetingId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_meeting_host', {
    meeting_id_input: meetingId,
    target_user_id_input: userId,
  })
  if (error) throw new Error(error.message)
}

export async function sendMeetingControl(
  meetingId: string,
  action:
    | 'request_mute'
    | 'force_mute'
    | 'ask_to_unmute'
    | 'stop_video'
    | 'mute_all'
    | 'ask_all_to_mute'
    | 'ask_all_to_unmute'
    | 'remove_all_except_host',
  targetUserId?: string,
): Promise<void> {
  const { error } = await supabase.rpc('moderate_meeting_participants', {
    meeting_id_input: meetingId,
    action_input: action,
    target_user_id_input: targetUserId ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function fetchMeetingControlEvents(
  meetingId: string,
  after: string,
): Promise<MeetingControlEvent[]> {
  const { data, error } = await supabase
    .from('meeting_control_events')
    .select('id, meeting_id, actor_id, target_user_id, action, created_at')
    .eq('meeting_id', meetingId)
    .gt('created_at', after)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as MeetingControlEvent[]
}

export async function fetchMeetingChat(meetingId: string): Promise<MeetingChatMessage[]> {
  const { data, error } = await supabase
    .from('meeting_chat_messages')
    .select(
      'id, meeting_id, sender_id, message_text, message_type, created_at, audience, recipient_id, system_event_type',
    )
    .eq('meeting_id', meetingId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(300)

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
  options?: {
    audience?: 'everyone' | 'hosts' | 'private'
    recipientId?: string | null
  },
): Promise<MeetingChatMessage> {
  const audience = options?.audience ?? 'everyone'
  if (audience === 'private' && !options?.recipientId) {
    throw new Error('Choose a participant for private chat.')
  }

  const { data, error } = await supabase
    .from('meeting_chat_messages')
    .insert({
      meeting_id: meetingId,
      sender_id: senderId,
      message_text: message.trim(),
      message_type: 'text',
      audience,
      recipient_id: audience === 'private' ? options?.recipientId ?? null : null,
    })
    .select(
      'id, meeting_id, sender_id, message_text, message_type, created_at, audience, recipient_id, system_event_type',
    )
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

export async function softDeleteMeetingChatMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_meeting_chat_message', {
    message_id_input: messageId,
  })
  if (error) throw new Error(error.message)
}

export { getMeetingShareUrl } from '~/lib/share/urls'

export function formatMeetingCode(code: string): string {
  const clean = normalizeMeetingCode(code)
  if (clean.length <= 3) return clean
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`.trim()
}
