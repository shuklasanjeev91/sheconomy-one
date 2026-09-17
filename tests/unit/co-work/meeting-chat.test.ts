import { describe, expect, it } from 'vitest'

import {
  formatMeetingSystemChatText,
  isMeetingChatEnabled,
  isMeetingPrivateChatEnabled,
  isMeetingSystemChatMessage,
  meetingChatComposerAudiences,
  meetingChatToolbarLabel,
} from '../../../co-work/lib/meeting-chat'
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

  it('respects meeting chat kill switches', () => {
    expect(isMeetingChatEnabled(meeting({ allowChat: false }))).toBe(false)
    expect(isMeetingChatEnabled(meeting({ allowChat: true }))).toBe(true)
    expect(isMeetingPrivateChatEnabled(meeting({ allowChat: true, allowPrivateChat: false }))).toBe(
      false,
    )
  })
})
