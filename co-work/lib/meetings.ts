import { supabase } from '~/lib/supabase/client'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { assertUtcIso, coerceIanaTimeZone, resolveDeviceIanaTimeZone } from '~/lib/calendar/timezone'

import { parseMeetingInvitees } from '~/co-work/lib/invites'
import {
  MEETING_CHAT_ATTACHMENT_BUCKET,
  meetingChatAttachmentMetadata,
  parseMeetingChatAttachmentMetadata,
} from '~/co-work/lib/meeting-chat-attachments'
import { MEETING_CONTENT_SIGNED_URL_TTL_SEC } from '~/co-work/lib/meeting-content-share'
import { normalizeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'
import { mapMeetingSecurityJoinError } from '~/co-work/lib/meeting-security'
import type {
  CreateMeetingInput,
  Meeting,
  MeetingChatAttachment,
  MeetingChatMessage,
  MeetingControlEvent,
  MeetingModerationSettings,
  MeetingParticipant,
  MeetingRole,
  MeetingSecuritySettings,
  UpdateMeetingScheduleInput,
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

type ScheduledStartFields = Pick<Meeting, 'status' | 'scheduled_at' | 'started_at'>

/**
 * Guests should wait (Zoom-style) until the scheduled start. Hosts can start
 * early. Once the host has started (`started_at` or live status), anyone can join.
 */
export function isWaitingForScheduledStart(
  meeting: ScheduledStartFields,
  now = Date.now(),
): boolean {
  if (meeting.status === 'active' || meeting.status === 'instant') return false
  if (meeting.started_at) return false
  if (meeting.status !== 'scheduled') return false
  const start = meeting.scheduled_at ? Date.parse(meeting.scheduled_at) : Number.NaN
  return Number.isFinite(start) && start > now
}

export function canEnterLiveMeeting(
  meeting: ScheduledStartFields,
  options: { isHost: boolean; now?: number },
): boolean {
  if (!isMeetingJoinable(meeting)) return false
  if (options.isHost) return true
  return !isWaitingForScheduledStart(meeting, options.now)
}

function parseJson<T>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null
  return value as T
}

function normalizeSecuritySettings(value: unknown): MeetingSecuritySettings | null {
  const raw = parseJson<Record<string, unknown>>(value)
  if (!raw) return null

  const chatWithRaw = (raw.participantChatWith ?? raw.participant_chat_with) as string | undefined
  const participantChatWith =
    chatWithRaw === 'hosts' || chatWithRaw === 'off' || chatWithRaw === 'everyone'
      ? chatWithRaw
      : raw.allowChat === false || raw.allow_chat === false
        ? 'off'
        : 'everyone'

  return {
    passcode: (raw.passcode as string | undefined) ?? undefined,
    requirePasscode: !!(raw.requirePasscode ?? raw.require_passcode),
    waitingRoom: !!(raw.waitingRoom ?? raw.waiting_room),
    muteOnJoin: !!(raw.muteOnJoin ?? raw.mute_on_join),
    videoOffOnJoin: !!(raw.videoOffOnJoin ?? raw.video_off_on_join),
    allowScreenShare: raw.allowScreenShare !== false && raw.allow_screen_share !== false,
    allowChat: raw.allowChat !== false && raw.allow_chat !== false && participantChatWith !== 'off',
    allowPrivateChat: raw.allowPrivateChat !== false && raw.allow_private_chat !== false,
    participantChatWith,
    allowRecording: raw.allowRecording !== false && raw.allow_recording !== false,
    allowHandRaise: raw.allowHandRaise !== false && raw.allow_hand_raise !== false,
    allowParticipantRename:
      raw.allowParticipantRename !== false && raw.allow_participant_rename !== false,
    allowSelfUnmute: raw.allowSelfUnmute !== false && raw.allow_self_unmute !== false,
    allowSelfStartVideo:
      raw.allowSelfStartVideo !== false && raw.allow_self_start_video !== false,
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

function generateMediaRoomId(): string {
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

function withViewerRole(
  meeting: Meeting,
  userId: string,
  roleByMeetingId: Record<string, MeetingRole>,
): Meeting {
  const fromRoles = roleByMeetingId[meeting.id]
  const viewer_role =
    meeting.host_id === userId
      ? 'host'
      : fromRoles === 'host' || fromRoles === 'co_host'
        ? fromRoles
        : fromRoles === 'participant'
          ? 'participant'
          : 'participant'
  return { ...meeting, viewer_role }
}

/** Current user's host / co-host / participant role for a meeting (from meeting_roles + host_id). */
export async function fetchMyMeetingRole(
  meetingId: string,
  userId: string,
  hostId?: string | null,
): Promise<MeetingRole> {
  if (hostId && hostId === userId) return 'host'

  const { data, error } = await supabase
    .from('meeting_roles')
    .select('role')
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const role = data?.role
  if (role === 'host' || role === 'co_host' || role === 'participant') return role
  if (hostId && hostId === userId) return 'host'
  return 'participant'
}

export async function fetchMyMeetings(userId: string): Promise<Meeting[]> {
  const hosted = await fetchHostedMeetings(userId)

  const [{ data: roleRows }, { data: participantRows, error: participantError }] = await Promise.all([
    supabase
      .from('meeting_roles')
      .select('meeting_id, role')
      .eq('user_id', userId)
      .in('role', ['host', 'co_host'])
      .limit(100),
    supabase.from('meeting_participants').select('meeting_id').eq('user_id', userId).limit(50),
  ])

  const roleByMeetingId: Record<string, MeetingRole> = {}
  for (const row of roleRows ?? []) {
    if (row.role === 'host' || row.role === 'co_host' || row.role === 'participant') {
      roleByMeetingId[row.meeting_id] = row.role
    }
  }

  const knownIds = new Set(hosted.map((meeting) => meeting.id))
  const coHostIds = (roleRows ?? [])
    .filter((row) => row.role === 'co_host' && !knownIds.has(row.meeting_id))
    .map((row) => row.meeting_id)

  const participantIds = participantError
    ? []
    : (participantRows ?? [])
        .map((row) => row.meeting_id)
        .filter((id) => !knownIds.has(id) && !coHostIds.includes(id))

  const extraIds = [...new Set([...coHostIds, ...participantIds])]
  if (!extraIds.length) {
    return hosted.map((meeting) => withViewerRole(meeting, userId, roleByMeetingId))
  }

  const { data: extraMeetings } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .in('id', extraIds)
    .in('status', LISTED_MEETING_STATUSES)
    .order('scheduled_at', { ascending: true, nullsFirst: false })

  const invited = (extraMeetings ?? []).map((row) => mapMeeting(row as Record<string, unknown>))
  return mergeHostedAndInvitedMeetings(hosted, invited).map((meeting) =>
    withViewerRole(meeting, userId, roleByMeetingId),
  )
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

/** Meeting code from a typed code or a pasted invite link (`…/co-work/meeting/ABC-DEF-GHI`). */
export function meetingCodeFromInput(input: string): string {
  const trimmed = input.trim()
  const fromLink = trimmed.match(/\/co-?work\/meeting\/([^/?#\s]+)/i)?.[1]
  return normalizeMeetingCode(fromLink ? decodeURIComponent(fromLink) : trimmed)
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
  const roomId = generateMediaRoomId()
  const now = new Date().toISOString()
  const status = input.startNow ? 'instant' : 'scheduled'
  const timeZone = coerceIanaTimeZone(input.timeZone?.trim() || resolveDeviceIanaTimeZone())
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

export async function updateMeetingSchedule(
  meetingId: string,
  input: UpdateMeetingScheduleInput,
): Promise<Meeting> {
  const timeZone = coerceIanaTimeZone(input.timeZone)
  const scheduledAt = assertUtcIso(input.scheduledAt, 'Start time')
  const scheduledEndAt = assertUtcIso(input.scheduledEndAt, 'End time')
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

  const { data, error } = await supabase.rpc('update_meeting_schedule_secure', {
    meeting_id_input: meetingId,
    title_input: input.title.trim(),
    description_input: input.description?.trim() || null,
    scheduled_at_input: scheduledAt,
    scheduled_end_at_input: scheduledEndAt,
    time_zone_input: timeZone,
    max_participants_input: input.maxParticipants ?? null,
    is_recurring_input: input.isRecurring ?? null,
    repeat_input: input.isRecurring ? (input.repeat ?? null) : null,
    security_settings_input: securitySettings,
    meeting_options_input: meetingOptions,
    invitees_input: input.invitees
      ? input.invitees.map((invitee) => ({
        ...invitee,
        invited_at: invitee.invited_at ?? new Date().toISOString(),
        status: invitee.status ?? 'pending',
      }))
      : null,
    convert_to_scheduled_input: input.convertToScheduled ?? false,
  })

  if (error) {
    if (/HOST_REQUIRED/i.test(error.message)) {
      throw new Error('Only the host or a co-host can edit this meeting.')
    }
    throw new Error(error.message)
  }

  invalidateCache(INVALIDATION_TOPICS.coWorkMeetings)
  return mapMeeting(data as Record<string, unknown>)
}

/** Host/co-host: rename topic without changing schedule (works for instant + live). */
export async function updateMeetingTitle(meetingId: string, title: string): Promise<Meeting> {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Title is required.')

  const { data, error } = await supabase.rpc('update_meeting_schedule_secure', {
    meeting_id_input: meetingId,
    title_input: trimmed,
  })

  if (error) {
    if (/HOST_REQUIRED/i.test(error.message)) {
      throw new Error('Only the host or a co-host can edit this meeting.')
    }
    throw new Error(error.message)
  }

  invalidateCache(INVALIDATION_TOPICS.coWorkMeetings)
  return mapMeeting(data as Record<string, unknown>)
}

export async function startMeeting(meetingId: string): Promise<void> {
  // Always read live status — InstantMeetingHost / lobby can pass a stale
  // cached `active` row after the meeting was ended, which skipped restart and
  // made the token function reject web joins with "This meeting is not active."
  const { data: row, error: statusError } = await supabase
    .from('meetings')
    .select('status')
    .eq('id', meetingId)
    .maybeSingle()
  if (statusError) throw new Error(statusError.message)
  if (row?.status === 'active') return
  if (row?.status === 'cancelled') throw new Error('The host cancelled this meeting.')

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

  // Soft capacity check before RPC — trigger also enforces MEETING_FULL.
  const { data: meetingRow } = await supabase
    .from('meetings')
    .select('max_participants, host_id')
    .eq('id', meetingId)
    .maybeSingle()
  if (meetingRow && _userId !== meetingRow.host_id) {
    const cap = meetingRow.max_participants ?? 100
    const { count } = await supabase
      .from('meeting_participants')
      .select('id', { count: 'exact', head: true })
      .eq('meeting_id', meetingId)
      .eq('status', 'admitted')
    if (typeof count === 'number' && count >= cap) {
      throw new Error('MEETING_FULL')
    }
  }

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

/** Rename this device's participant row mid-meeting (the name shown in the roster). */
export async function updateMeetingParticipantDisplayName(
  meetingId: string,
  sessionId: string,
  displayName: string,
): Promise<void> {
  const cleanedDisplayName = normalizeMeetingDisplayName(displayName)
  if (!cleanedDisplayName) return
  const { error } = await supabase.rpc('set_meeting_participant_display_name', {
    meeting_id_input: meetingId,
    session_id_input: sessionId,
    display_name_input: cleanedDisplayName,
  })
  if (error) throw new Error(error.message)
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

/** Send an admitted participant back to the waiting room (Zoom-style). */
export async function putMeetingParticipantInWaitingRoom(
  meetingId: string,
  targetUserId: string,
): Promise<void> {
  const { error } = await supabase.rpc('moderate_meeting_participants', {
    meeting_id_input: meetingId,
    action_input: 'put_in_waiting_room',
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
  if (error) {
    if (/HOST_REQUIRED/i.test(error.message)) {
      throw new Error('Only the host or a co-host can cancel this meeting.')
    }
    throw new Error(error.message)
  }

  invalidateCache(INVALIDATION_TOPICS.coWorkMeetings)
}

/** Patch live security / room options mid-meeting (Zoom Host tools). Host only. */
export async function updateMeetingLiveSettings(
  meetingId: string,
  patch: {
    securitySettings?: Partial<MeetingSecuritySettings>
    meetingOptions?: Partial<NonNullable<Meeting['meeting_options']>>
  },
): Promise<Meeting> {
  const securityPatch = patch.securitySettings
    ? {
        ...patch.securitySettings,
        ...(patch.securitySettings.participantChatWith
          ? {
              allowChat: patch.securitySettings.participantChatWith !== 'off',
              allow_chat: patch.securitySettings.participantChatWith !== 'off',
              participantChatWith: patch.securitySettings.participantChatWith,
              participant_chat_with: patch.securitySettings.participantChatWith,
            }
          : {}),
        ...(typeof patch.securitySettings.allowScreenShare === 'boolean'
          ? {
              allowScreenShare: patch.securitySettings.allowScreenShare,
              allow_screen_share: patch.securitySettings.allowScreenShare,
            }
          : {}),
        ...(typeof patch.securitySettings.allowRecording === 'boolean'
          ? {
              allowRecording: patch.securitySettings.allowRecording,
              allow_recording: patch.securitySettings.allowRecording,
            }
          : {}),
        ...(typeof patch.securitySettings.allowHandRaise === 'boolean'
          ? {
              allowHandRaise: patch.securitySettings.allowHandRaise,
              allow_hand_raise: patch.securitySettings.allowHandRaise,
            }
          : {}),
        ...(typeof patch.securitySettings.allowParticipantRename === 'boolean'
          ? {
              allowParticipantRename: patch.securitySettings.allowParticipantRename,
              allow_participant_rename: patch.securitySettings.allowParticipantRename,
            }
          : {}),
        ...(typeof patch.securitySettings.allowSelfUnmute === 'boolean'
          ? {
              allowSelfUnmute: patch.securitySettings.allowSelfUnmute,
              allow_self_unmute: patch.securitySettings.allowSelfUnmute,
            }
          : {}),
        ...(typeof patch.securitySettings.allowSelfStartVideo === 'boolean'
          ? {
              allowSelfStartVideo: patch.securitySettings.allowSelfStartVideo,
              allow_self_start_video: patch.securitySettings.allowSelfStartVideo,
            }
          : {}),
        ...(typeof patch.securitySettings.waitingRoom === 'boolean'
          ? {
              waitingRoom: patch.securitySettings.waitingRoom,
              waiting_room: patch.securitySettings.waitingRoom,
            }
          : {}),
        ...(typeof patch.securitySettings.muteOnJoin === 'boolean'
          ? {
              muteOnJoin: patch.securitySettings.muteOnJoin,
              mute_on_join: patch.securitySettings.muteOnJoin,
            }
          : {}),
        ...(typeof patch.securitySettings.videoOffOnJoin === 'boolean'
          ? {
              videoOffOnJoin: patch.securitySettings.videoOffOnJoin,
              video_off_on_join: patch.securitySettings.videoOffOnJoin,
            }
          : {}),
        ...(typeof patch.securitySettings.allowPrivateChat === 'boolean'
          ? {
              allowPrivateChat: patch.securitySettings.allowPrivateChat,
              allow_private_chat: patch.securitySettings.allowPrivateChat,
            }
          : {}),
      }
    : null

  const { data, error } = await supabase.rpc('update_meeting_live_settings', {
    meeting_id_input: meetingId,
    security_settings_patch: securityPatch,
    meeting_options_patch: patch.meetingOptions ?? null,
  })

  if (error) {
    if (/HOST_REQUIRED/i.test(error.message)) {
      throw new Error('Only the host can change these meeting settings.')
    }
    throw new Error(error.message)
  }

  return mapMeeting(data as Record<string, unknown>)
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

const MEETING_CHAT_COLUMNS =
  'id, meeting_id, sender_id, message_text, message_type, created_at, audience, recipient_id, system_event_type, metadata'

/** Reuse a signed URL while it has this long left, so chat images don't reload on every poll. */
const SIGNED_URL_REUSE_MIN_MS = 60 * 60 * 1000
const signedAttachmentUrls = new Map<string, { url: string; expiresAt: number }>()

export function rememberMeetingChatAttachmentUrl(path: string, url: string): void {
  signedAttachmentUrls.set(path, {
    url,
    expiresAt: Date.now() + MEETING_CONTENT_SIGNED_URL_TTL_SEC * 1000,
  })
}

async function signMeetingChatAttachmentPaths(paths: string[]): Promise<Map<string, string>> {
  const now = Date.now()
  const out = new Map<string, string>()
  const missing: string[] = []
  for (const path of new Set(paths)) {
    const cached = signedAttachmentUrls.get(path)
    if (cached && cached.expiresAt - now > SIGNED_URL_REUSE_MIN_MS) out.set(path, cached.url)
    else missing.push(path)
  }
  if (missing.length === 0) return out
  const { data } = await supabase.storage
    .from(MEETING_CHAT_ATTACHMENT_BUCKET)
    .createSignedUrls(missing, MEETING_CONTENT_SIGNED_URL_TTL_SEC)
  for (const row of data ?? []) {
    if (!row.path || !row.signedUrl || row.error) continue
    rememberMeetingChatAttachmentUrl(row.path, row.signedUrl)
    out.set(row.path, row.signedUrl)
  }
  return out
}

type MeetingChatRow = Omit<MeetingChatMessage, 'attachment' | 'sender'> & { metadata?: unknown }

async function withMeetingChatAttachments(rows: MeetingChatRow[]): Promise<Array<Omit<MeetingChatMessage, 'sender'>>> {
  const stored = rows.map((row) =>
    parseMeetingChatAttachmentMetadata(row.metadata, row.meeting_id, row.sender_id),
  )
  const paths = stored.flatMap((attachment) => (attachment ? [attachment.path] : []))
  const urls = paths.length > 0 ? await signMeetingChatAttachmentPaths(paths).catch(() => new Map()) : new Map()
  return rows.map(({ metadata: _metadata, ...row }, index) => {
    const attachment = stored[index]
    return {
      ...row,
      attachment: attachment ? { ...attachment, url: urls.get(attachment.path) ?? null } : null,
    }
  })
}

export async function fetchMeetingChat(meetingId: string): Promise<MeetingChatMessage[]> {
  const { data, error } = await supabase
    .from('meeting_chat_messages')
    .select(MEETING_CHAT_COLUMNS)
    .eq('meeting_id', meetingId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(300)

  if (error) throw new Error(error.message)

  const rows = await withMeetingChatAttachments((data ?? []) as MeetingChatRow[])
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
    /** Already uploaded with `uploadMeetingFile`. */
    attachment?: MeetingChatAttachment
  },
): Promise<MeetingChatMessage> {
  const audience = options?.audience ?? 'everyone'
  if (audience === 'private' && !options?.recipientId) {
    throw new Error('Choose a participant for private chat.')
  }
  const attachment = options?.attachment ?? null

  const { data, error } = await supabase
    .from('meeting_chat_messages')
    .insert({
      meeting_id: meetingId,
      sender_id: senderId,
      message_text: message.trim() || attachment?.fileName || '',
      message_type: 'text',
      audience,
      recipient_id: audience === 'private' ? options?.recipientId ?? null : null,
      ...(attachment ? { metadata: meetingChatAttachmentMetadata(attachment) } : {}),
    })
    .select(MEETING_CHAT_COLUMNS)
    .single()

  if (error) throw new Error(error.message)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, avatar_url')
    .eq('id', senderId)
    .maybeSingle()

  const { metadata: _metadata, ...row } = data as MeetingChatRow
  if (attachment?.url) rememberMeetingChatAttachmentUrl(attachment.path, attachment.url)
  return {
    ...row,
    attachment,
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
