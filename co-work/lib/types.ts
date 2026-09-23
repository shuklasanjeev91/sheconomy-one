import type { WhiteboardStroke } from '~/co-work/lib/meeting-whiteboard'

export type MeetingStatus = 'scheduled' | 'instant' | 'active' | 'ended' | 'cancelled'

export type ParticipantStatus = 'waiting' | 'admitted' | 'rejected' | 'left' | 'removed'
export type MeetingRole = 'host' | 'co_host' | 'participant'

export type MeetingParticipantChatWith = 'everyone' | 'hosts' | 'off'

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
  /**
   * Who participants may chat with (Zoom-style).
   * Hosts/co-hosts always keep full chat composer options.
   */
  participantChatWith?: MeetingParticipantChatWith
  allowRecording?: boolean
  allowHandRaise?: boolean
  /** Participants may rename themselves in the room. */
  allowParticipantRename?: boolean
  /** Participants may unmute themselves after being muted. */
  allowSelfUnmute?: boolean
  /** Participants may turn their camera on. */
  allowSelfStartVideo?: boolean
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
  /** Current viewer's role when loaded for My Meetings / schedule edit. */
  viewer_role?: MeetingRole | null
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
  | 'put_in_waiting_room'

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

export type UpdateMeetingScheduleInput = {
  title: string
  description?: string
  scheduledAt: string
  scheduledEndAt: string
  timeZone: string
  maxParticipants?: number
  securitySettings?: MeetingSecuritySettings
  meetingOptions?: MeetingOptions
  isRecurring?: boolean
  repeat?: MeetingRepeat
  invitees?: MeetingInvitee[]
  /** When editing an instant/ended meeting into a future slot, flip status to scheduled. */
  convertToScheduled?: boolean
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
  /** Peers start/stop publishing local STT so others can view translated captions. */
  | { type: 'caption-wanted'; from: string; wanted: boolean; timestamp: number }
  | { type: 'chat'; from: string; message: MeetingChatMessage }
  | { type: 'reaction'; from: string; emoji: string; name: string; timestamp: number }
  /** Zoom nonverbal feedback — sticky yes/no/slow/faster/break/away. */
  | {
      type: 'nonverbal-feedback'
      from: string
      status: 'yes' | 'no' | 'slow' | 'faster' | 'break' | 'away' | null
      name?: string
      timestamp: number
    }
  /** Host: lower every raised hand in the room. */
  | { type: 'lower-all-hands'; from: string; timestamp: number }
  /** Host: lower one participant's raised hand. */
  | { type: 'lower-hand'; from: string; targetUserId: string; timestamp: number }
  /** Host: clear nonverbal feedback for everyone. */
  | { type: 'clear-all-feedback'; from: string; timestamp: number }
  /** Host: live topic/title rename (UI sync). */
  | { type: 'meeting-topic'; from: string; title: string; timestamp: number }
  | { type: 'meeting-ended'; from: string; timestamp: number }
  | { type: 'whiteboard-open'; from: string; name?: string }
  | { type: 'whiteboard-close'; from: string }
  | { type: 'whiteboard-stroke'; from: string; stroke: WhiteboardStroke }
  | { type: 'whiteboard-undo'; from: string; strokeId?: string }
  | { type: 'whiteboard-clear'; from: string }
  /** Host/co-host spotlight — every viewer focuses this participant. */
  | { type: 'spotlight'; from: string; targetUserId: string | null; timestamp: number }
  /** Request remote control of a screen share (ack is UI-only). */
  | { type: 'remote-control-request'; from: string; to: string; name?: string; timestamp: number }
  | { type: 'remote-control-response'; from: string; to: string; accepted: boolean; timestamp: number }
  /** Live interpretation channel hint (UI routing). */
  | { type: 'interpretation-channel'; from: string; channelId: string | null; timestamp: number }
  /** Host webinar mode — attendees stay muted with hand-raise privileges. */
  | { type: 'webinar-mode'; from: string; enabled: boolean; timestamp: number }
  /** Host broadcast into open breakout rooms. */
  | { type: 'breakout-broadcast'; from: string; message: string; timestamp: number }
  /** Host breakout timer end — participants should return to main room. */
  | { type: 'breakout-timer'; from: string; endsAt: number | null; timestamp: number }
  /** Screen-share annotation stroke (synced to viewers). */
  | {
      type: 'annotation-stroke'
      from: string
      stroke: {
        id: string
        color: string
        width: number
        points: Array<{ x: number; y: number }>
        from: string
        createdAt: number
      }
      timestamp: number
    }
  | { type: 'annotation-clear'; from: string; timestamp: number }
  | { type: 'annotation-open'; from: string; timestamp: number }
  | { type: 'annotation-close'; from: string; timestamp: number }
  /** Host: transferred host role to another participant. */
  | { type: 'host-transferred'; from: string; newHostId: string; newHostName?: string; timestamp: number }
  /** Host/recorder: immediate broadcast of active recording status. */
  | { type: 'recording-status'; from: string; isRecording: boolean; timestamp: number }

export type MediaCapabilities = {
  supportsVideo: boolean
  supportsScreenShare: boolean
  supportsRecording: boolean
  supportsLiveCaptions: boolean
  platform: 'web' | 'ios' | 'android'
}
