import { describe, expect, it } from 'vitest'

import {
  canViewerSeeMeetingChatMessage,
  formatMeetingSystemChatText,
  isMeetingChatEnabled,
  isMeetingPrivateChatEnabled,
  isMeetingSystemChatMessage,
  meetingChatComposerAudiences,
  meetingChatMessageInSelectedChannel,
  meetingChatToolbarLabel,
} from '../../../co-work/lib/meeting-chat'
import { parseMeetingChatTextLinks } from '../../../co-work/lib/meeting-chat-links'
import {
  meetingChatShareMetadata,
  parseMeetingChatShareMetadata,
} from '../../../co-work/lib/meeting-chat-share'
import type { Meeting } from '../../../co-work/lib/types'

function meeting(partial?: Partial<Meeting['security_settings']> & { enableMeetingChat?: boolean }): Meeting {
  return {
    id: 'm1',
    title: 'Test',
    description: null,
    meeting_code: 'ABC123',
    host_id: 'h1',
    status: 'active',
    scheduled_at: null,
    scheduled_end_at: null,
    started_at: null,
    ended_at: null,
    time_zone: null,
    max_participants: null,
    room_id: 'r1',
    security_settings: {
      allowChat: partial?.allowChat,
      allowPrivateChat: partial?.allowPrivateChat,
    },
    meeting_options: {
      enableMeetingChat: partial?.enableMeetingChat,
    },
    created_at: null,
  }
}

describe('meeting chat', () => {
  it('formats system lifecycle copy', () => {
    expect(formatMeetingSystemChatText('participant_joined', 'John')).toBe('John joined')
    expect(formatMeetingSystemChatText('participant_left', 'John')).toBe('John left')
    expect(formatMeetingSystemChatText('participant_admitted', 'Mary')).toBe('Mary was admitted')
    expect(formatMeetingSystemChatText('mute_all', 'Host')).toBe('Host muted all participants')
  })

  it('builds Chat (N) toolbar labels', () => {
    expect(meetingChatToolbarLabel(0)).toBe('Chat')
    expect(meetingChatToolbarLabel(3)).toBe('Chat (3)')
    expect(meetingChatToolbarLabel(100)).toBe('Chat (99+)')
  })

  it('parses clickable links inside chat text', () => {
    expect(parseMeetingChatTextLinks('Join https://example.com/demo now')).toEqual([
      { type: 'text', text: 'Join ' },
      { type: 'link', text: 'https://example.com/demo', url: 'https://example.com/demo' },
      { type: 'text', text: ' now' },
    ])
    expect(parseMeetingChatTextLinks('Open www.example.com/test.')).toEqual([
      { type: 'text', text: 'Open ' },
      { type: 'link', text: 'www.example.com/test', url: 'https://www.example.com/test' },
      { type: 'text', text: '.' },
    ])
  })

  it('stores and validates meeting chat share metadata', () => {
    const share = {
      kind: 'listing' as const,
      id: 'listing-1',
      title: 'Handmade tote',
      subtitle: 'SHE shop',
      imageUrl: null,
      href: '/listing/handmade-tote',
      ownerUserId: 'seller-1',
      price: 1299,
      currency: 'INR',
    }

    expect(parseMeetingChatShareMetadata(meetingChatShareMetadata(share))).toEqual(share)
    expect(
      parseMeetingChatShareMetadata({
        share: { ...share, href: 'https://example.com/listing/handmade-tote' },
      }),
    ).toBeNull()
  })

  it('detects system messages', () => {
    expect(
      isMeetingSystemChatMessage({
        audience: 'system',
        message_type: 'system',
        system_event_type: 'participant_joined',
      }),
    ).toBe(true)
    expect(
      isMeetingSystemChatMessage({
        audience: 'everyone',
        message_type: 'text',
        system_event_type: null,
      }),
    ).toBe(false)
  })

  it('exposes composer audiences for participants and moderators', () => {
    expect(meetingChatComposerAudiences({ viewerRole: 'participant', privateEnabled: true })).toEqual([
      'everyone',
      'private',
    ])
    expect(meetingChatComposerAudiences({ viewerRole: 'co_host', privateEnabled: false })).toEqual([
      'everyone',
      'hosts',
    ])
  })

  it('shows everyone, private, and host chats only in their own thread', () => {
    const everyone = {
      audience: 'everyone' as const,
      message_type: 'text',
      sender_id: 'a',
      recipient_id: null,
      system_event_type: null,
    }
    const privateToSam = {
      audience: 'private' as const,
      message_type: 'text',
      sender_id: 'me',
      recipient_id: 'sam',
      system_event_type: null,
    }
    const hosts = {
      audience: 'hosts' as const,
      message_type: 'text',
      sender_id: 'host',
      recipient_id: null,
      system_event_type: null,
    }

    expect(
      meetingChatMessageInSelectedChannel({
        message: everyone,
        audience: 'everyone',
        currentUserId: 'me',
      }),
    ).toBe(true)
    expect(
      meetingChatMessageInSelectedChannel({
        message: privateToSam,
        audience: 'everyone',
        currentUserId: 'me',
      }),
    ).toBe(false)
    expect(
      meetingChatMessageInSelectedChannel({
        message: privateToSam,
        audience: 'private',
        recipientId: 'sam',
        currentUserId: 'me',
      }),
    ).toBe(true)
    expect(
      meetingChatMessageInSelectedChannel({
        message: privateToSam,
        audience: 'private',
        recipientId: 'other',
        currentUserId: 'me',
      }),
    ).toBe(false)
    expect(
      meetingChatMessageInSelectedChannel({
        message: hosts,
        audience: 'hosts',
        currentUserId: 'host',
      }),
    ).toBe(true)
    expect(
      meetingChatMessageInSelectedChannel({
        message: everyone,
        audience: 'hosts',
        currentUserId: 'host',
      }),
    ).toBe(false)
  })

  it('hides private and host messages from people who are not in that chat', () => {
    expect(
      canViewerSeeMeetingChatMessage({
        message: {
          audience: 'private',
          message_type: 'text',
          sender_id: 'a',
          recipient_id: 'b',
          system_event_type: null,
        },
        viewerId: 'c',
        viewerRole: 'participant',
      }),
    ).toBe(false)
    expect(
      canViewerSeeMeetingChatMessage({
        message: {
          audience: 'private',
          message_type: 'text',
          sender_id: 'a',
          recipient_id: 'b',
          system_event_type: null,
        },
        viewerId: 'b',
        viewerRole: 'participant',
      }),
    ).toBe(true)
    expect(
      canViewerSeeMeetingChatMessage({
        message: {
          audience: 'hosts',
          message_type: 'text',
          sender_id: 'host',
          recipient_id: null,
          system_event_type: null,
        },
        viewerId: 'guest',
        viewerRole: 'participant',
      }),
    ).toBe(false)
    expect(
      canViewerSeeMeetingChatMessage({
        message: {
          audience: 'hosts',
          message_type: 'text',
          sender_id: 'host',
          recipient_id: null,
          system_event_type: null,
        },
        viewerId: 'co',
        viewerRole: 'co_host',
      }),
    ).toBe(true)
  })

  it('respects meeting chat kill switches', () => {
    expect(isMeetingChatEnabled(meeting({ allowChat: false }))).toBe(false)
    expect(isMeetingChatEnabled(meeting({ allowChat: true }))).toBe(true)
    expect(isMeetingPrivateChatEnabled(meeting({ allowChat: true, allowPrivateChat: false }))).toBe(
      false,
    )
  })
})
