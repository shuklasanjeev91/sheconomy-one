export type MeetingStatus = 'scheduled' | 'instant' | 'active' | 'ended' | 'cancelled'

export type ParticipantStatus = 'waiting' | 'admitted' | 'rejected' | 'left' | 'removed'
export type MeetingRole = 'host' | 'co_host' | 'participant'

export type MeetingSecuritySettings = {
  passcode?: string
  requirePasscode?: boolean
  waitingRoom?: boolean
  muteOnJoin?: boolean
  videoOffOnJoin?: boolean
  allowScreenShare?: boolean
  allowChat?: boolean
  /** Direct participant-to-participant chat when meeting chat is on. */
  allowPrivateChat?: boolean
  allowRecording?: boolean
  allowHandRaise?: boolean
  authenticatedUsersOnly?: boolean
}

export type MeetingRepeat = 'daily' | 'weekly' | 'monthly' | null

export type MeetingInviteeType = 'user' | 'email'

/** Stored in meetings.invitees JSONB (sheconomy_db). */
export type MeetingInvitee = {
  id: string
  type: MeetingInviteeType
  name: string
  email?: string
  avatar?: string | null
  headline?: string | null
  invited_at?: string
  status?: 'pending' | 'sent' | 'joined'
  /** Recipient IANA timezone when known — used for invite email display. */
  timeZone?: string
  locale?: string
}

export type MeetingInviteCandidate = {
  user_id: string
  full_name: string
  username: string | null
  email: string | null
  avatar_url: string | null
  headline: string | null
  source: 'connection' | 'search'
}

export type MeetingOptions = {
  layout?: 'grid' | 'speaker'
  defaultVideo?: boolean
  defaultAudio?: boolean
  allowJoinBeforeHost?: boolean
  autoRecord?: boolean
  recordingMode?: 'disabled' | 'manual' | 'automatic'
  captionsEnabled?: boolean
  enableMeetingChat?: boolean
}

export type Meeting = {
  id: string
  title: string
  description: string | null
  meeting_code: string
  host_id: string
  status: MeetingStatus
  scheduled_at: string | null
  scheduled_end_at: string | null
  started_at: string | null
  ended_at: string | null
  time_zone: string | null
  max_participants: number | null
  room_id: string | null
  security_settings: MeetingSecuritySettings | null
  meeting_options: MeetingOptions | null
  created_at: string | null
  is_recurring?: boolean | null
  repeat?: MeetingRepeat
  invitees?: MeetingInvitee[] | null
  host?: {
    full_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

export type MeetingParticipant = {
  id: string
  meeting_id: string
  user_id: string
  display_name?: string | null
  status: ParticipantStatus
  is_host: boolean | null
  is_muted: boolean | null
  is_video_off: boolean | null
  joined_at: string | null
  left_at: string | null
  role: MeetingRole
  profile?: {
    full_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

export type MeetingModerationSettings = {
  meeting_id: string
  is_locked: boolean
  host_leave_behavior: 'end' | 'transfer_to_co_host'
}

export type MeetingControlAction =
  | 'request_mute'
  | 'force_mute'
  | 'ask_to_unmute'
  | 'stop_video'
  | 'mute_all'
  | 'ask_all_to_mute'
  | 'ask_all_to_unmute'
  | 'removed'
  | 'remove_all_except_host'
  | 'meeting_ended'

export type MeetingControlEvent = {
  id: string
  meeting_id: string
  actor_id: string
  target_user_id: string | null
  action: MeetingControlAction
  created_at: string
}

export type MeetingChatMessage = {
  id: string
  meeting_id: string
  sender_id: string
  message_text: string
  message_type: string
  created_at: string | null
  audience?: 'everyone' | 'hosts' | 'private' | 'system'
  recipient_id?: string | null
  system_event_type?: string | null
  sender?: {
    full_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

export type CreateMeetingInput = {
  title: string
  description?: string
  scheduledAt?: string
  scheduledEndAt?: string
  timeZone?: string
  maxParticipants?: number
  securitySettings?: MeetingSecuritySettings
  meetingOptions?: MeetingOptions
  startNow?: boolean
  isRecurring?: boolean
  repeat?: MeetingRepeat
  invitees?: MeetingInvitee[]
}

export type RemoteParticipantState = {
  peerId: string
  userId: string
  displayName: string
  avatarUrl?: string | null
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  handRaised: boolean
  isHost: boolean
  stream?: MediaStream | null
  screenStream?: MediaStream | null
}

export type SignalPayload =
  | { type: 'offer'; from: string; to: string; sdp: string }
  | { type: 'answer'; from: string; to: string; sdp: string }
  | { type: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'presence'; from: string; audio: boolean; video: boolean; screen: boolean; hand: boolean }
  | { type: 'mute-all'; from: string }
  | { type: 'kick'; from: string; to: string }
  | { type: 'caption'; from: string; speaker: string; text: string; isFinal: boolean; timestamp: number; sourceLang?: string }
  | { type: 'chat'; from: string; message: MeetingChatMessage }
  | { type: 'reaction'; from: string; emoji: string; name: string; timestamp: number }
  | { type: 'meeting-ended'; from: string; timestamp: number }

export type MediaCapabilities = {
  supportsVideo: boolean
  supportsScreenShare: boolean
  supportsRecording: boolean
  supportsLiveCaptions: boolean
  platform: 'web' | 'ios' | 'android'
}
