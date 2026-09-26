import type { Meeting, MeetingChatMessage, MeetingRole } from '~/co-work/lib/types'
import type { MeetingChatAudience } from '~/co-work/lib/meeting-role-permissions'
import { canManageMeetingChat, canSendHostsOnlyChat } from '~/co-work/lib/meeting-role-permissions'
import { meetingFeatureFlags } from '~/co-work/lib/meeting-feature-flags'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'

export type MeetingSystemChatEvent =
  | 'participant_joined'
  | 'participant_left'
  | 'participant_admitted'
  | 'mute_all'

export function isMeetingChatEnabled(meeting: Pick<Meeting, 'security_settings' | 'meeting_options'>): boolean {
  if (meeting.security_settings?.participantChatWith === 'off') return false
  if (meeting.security_settings?.allowChat === false) return false
  if (meeting.meeting_options?.enableMeetingChat === false) return false
  return true
}

/** Private 1:1 chat — on when meeting chat is on and audience chat is not killed. */
export function isMeetingPrivateChatEnabled(
  meeting: Pick<Meeting, 'security_settings' | 'meeting_options'>,
): boolean {
  if (!isMeetingChatEnabled(meeting)) return false
  if (meeting.security_settings?.participantChatWith === 'hosts') return false
  if (meeting.security_settings?.allowPrivateChat === false) return false
  return meetingFeatureFlags.audienceChat
}

export function meetingChatComposerAudiences(input: {
  viewerRole: MeetingRole
  privateEnabled: boolean
  participantChatWith?: 'everyone' | 'hosts' | 'off' | null
}): MeetingChatAudience[] {
  const chatWith = input.participantChatWith ?? 'everyone'
  const isModerator = canManageMeetingChat(input.viewerRole)

  if (!isModerator && chatWith === 'off') return []
  if (!isModerator && chatWith === 'hosts') return ['hosts']

  const audiences: MeetingChatAudience[] = ['everyone']
  if (input.privateEnabled) audiences.push('private')
  if (canSendHostsOnlyChat(input.viewerRole)) audiences.push('hosts')
  return audiences
}

export function meetingChatToolbarLabel(unreadCount: number): string {
  if (unreadCount <= 0) return 'Chat'
  if (unreadCount > 99) return 'Chat (99+)'
  return `Chat (${unreadCount})`
}

export function isMeetingSystemChatMessage(
  message: Pick<MeetingChatMessage, 'audience' | 'message_type' | 'system_event_type'> | null | undefined,
): boolean {
  if (!message) return false
  return (
    message.audience === 'system' ||
    message.message_type === 'system' ||
    !!message.system_event_type
  )
}

export function formatMeetingSystemChatText(
  event: MeetingSystemChatEvent,
  participantName: string,
): string {
  const name = safeMeetingDisplayName(participantName, 'Someone')
  switch (event) {
    case 'participant_joined':
      return `${name} joined`
    case 'participant_left':
      return `${name} left`
    case 'participant_admitted':
      return `${name} was admitted`
    case 'mute_all':
      return 'Host muted all participants'
  }
}

/** Who may receive this message. Private stays with the two people; host chat stays with hosts. */
export function canViewerSeeMeetingChatMessage(input: {
  message: Pick<
    MeetingChatMessage,
    'audience' | 'message_type' | 'sender_id' | 'recipient_id' | 'system_event_type'
  >
  viewerId: string
  viewerRole: MeetingRole
}): boolean {
  if (isMeetingSystemChatMessage(input.message)) return true
  const audience = input.message.audience ?? 'everyone'
  if (audience === 'everyone') return true
  if (audience === 'hosts') {
    return canManageMeetingChat(input.viewerRole) || input.message.sender_id === input.viewerId
  }
  if (audience === 'private') {
    return (
      input.message.sender_id === input.viewerId || input.message.recipient_id === input.viewerId
    )
  }
  return false
}

/** Zoom-style thread: the open To: target is the only conversation on screen. */
export function meetingChatMessageInSelectedChannel(input: {
  message: Pick<
    MeetingChatMessage,
    'audience' | 'message_type' | 'sender_id' | 'recipient_id' | 'system_event_type'
  >
  audience: MeetingChatAudience
  recipientId?: string | null
  currentUserId?: string | null
}): boolean {
  if (isMeetingSystemChatMessage(input.message)) return input.audience === 'everyone'
  const messageAudience = input.message.audience ?? 'everyone'
  if (input.audience === 'everyone') return messageAudience === 'everyone'
  if (input.audience === 'hosts') return messageAudience === 'hosts'
  if (input.audience !== 'private' || !input.recipientId || !input.currentUserId) return false
  if (messageAudience !== 'private') return false
  const parties = [input.message.sender_id, input.message.recipient_id]
  return parties.includes(input.currentUserId) && parties.includes(input.recipientId)
}

export function meetingChatMessagePreview(
  message: MeetingChatMessage,
  participantDisplayNames: Record<string, string> = {},
): string {
  if (isMeetingSystemChatMessage(message)) {
    return message.message_text
  }
  if (message.audience === 'hosts') {
    return `[Hosts] ${message.message_text}`
  }
  if (message.audience === 'private') {
    const to =
      (message.recipient_id && participantDisplayNames[message.recipient_id]) || 'participant'
    return `[Private · ${to}] ${message.message_text}`
  }
  return message.message_text
}

export function canDeleteMeetingChatMessage(input: {
  viewerRole: MeetingRole
  message: MeetingChatMessage
  currentUserId: string
}): boolean {
  if (isMeetingSystemChatMessage(input.message)) return false
  if (!canManageMeetingChat(input.viewerRole) && input.message.sender_id !== input.currentUserId) {
    return false
  }
  return canManageMeetingChat(input.viewerRole) || input.message.sender_id === input.currentUserId
}
