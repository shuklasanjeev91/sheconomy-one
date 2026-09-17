import { describe, expect, it } from 'vitest'

import {
  collaborationChatSurfaceDescription,
  collaborationChatSurfaceLabel,
  COWORK_MAIN_CHAT_SURFACE,
  coworkMainChatUnreadTotal,
  isCoworkMainChatConversationType,
  MEETING_CHAT_SURFACE,
} from '../../../co-work/lib/main-chat'

describe('co-work main chat surface', () => {
  it('labels main chat and meeting chat differently', () => {
    expect(collaborationChatSurfaceLabel(COWORK_MAIN_CHAT_SURFACE)).toBe('Co-Work Main Chat')
    expect(collaborationChatSurfaceLabel(MEETING_CHAT_SURFACE)).toBe('Meeting Chat')
    expect(collaborationChatSurfaceDescription(COWORK_MAIN_CHAT_SURFACE)).toMatch(/Persistent/i)
    expect(collaborationChatSurfaceDescription(MEETING_CHAT_SURFACE)).toMatch(/meeting/i)
  })

  it('recognizes cowork conversation type only', () => {
    expect(isCoworkMainChatConversationType('cowork')).toBe(true)
    expect(isCoworkMainChatConversationType('direct')).toBe(false)
    expect(isCoworkMainChatConversationType('group')).toBe(false)
  })

  it('sums unread for main chat inbox badges', () => {
    expect(coworkMainChatUnreadTotal([{ unreadCount: 2 }, { unreadCount: 0 }, { unreadCount: 5 }])).toBe(
      7,
    )
  })
})
