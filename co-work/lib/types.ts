export type MeetingStatus = 'scheduled' | 'instant' | 'active' | 'ended' | 'cancelled'

export type ParticipantStatus = 'waiting' | 'admitted' | 'rejected' | 'left'

export type MeetingSecuritySettings = {
  passcode?: string
  requirePasscode?: boolean
  waitingRoom?: boolean
  muteOnJoin?: boolean
  videoOffOnJoin?: boolean
  allowScreenShare?: boolean
  allowChat?: boolean
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
  status: ParticipantStatus
  is_host: boolean | null
  is_muted: boolean | null
  is_video_off: boolean | null
  joined_at: string | null
  left_at: string | null
  profile?: {
    full_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

export type MeetingChatMessage = {
  id: string
  meeting_id: string
  sender_id: string
  message_text: string
  message_type: string
  created_at: string | null
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

export type MediaCapabilities = {
  supportsVideo: boolean
  supportsScreenShare: boolean
  supportsRecording: boolean
  platform: 'web' | 'native'
}
