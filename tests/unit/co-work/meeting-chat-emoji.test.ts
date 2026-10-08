import { describe, expect, it } from 'vitest'

import { MEETING_CHAT_EMOJI_CATEGORIES, meetingChatEmojiOnlyCount } from '~/co-work/lib/meeting-chat-emoji'

describe('meetingChatEmojiOnlyCount', () => {
  it('counts one to three emoji', () => {
    expect(meetingChatEmojiOnlyCount('👍')).toBe(1)
    expect(meetingChatEmojiOnlyCount('🎉 🎉')).toBe(2)
    expect(meetingChatEmojiOnlyCount('❤️🔥👏')).toBe(3)
  })

  it('handles joined sequences as one emoji', () => {
    expect(meetingChatEmojiOnlyCount('🙋‍♀️')).toBe(1)
    expect(meetingChatEmojiOnlyCount('👩‍💻👍')).toBe(2)
  })

  it('counts keyboard emoji outside the picker', () => {
    expect(meetingChatEmojiOnlyCount('🦒')).toBe(1)
  })

  it('is 0 for text, mixed text, empty, or more than three', () => {
    expect(meetingChatEmojiOnlyCount('Hello')).toBe(0)
    expect(meetingChatEmojiOnlyCount('Nice 👍')).toBe(0)
    expect(meetingChatEmojiOnlyCount('sticker:she-01')).toBe(0)
    expect(meetingChatEmojiOnlyCount('')).toBe(0)
    expect(meetingChatEmojiOnlyCount(null)).toBe(0)
    expect(meetingChatEmojiOnlyCount('👍👍👍👍')).toBe(0)
    expect(meetingChatEmojiOnlyCount('123')).toBe(0)
  })
})

describe('MEETING_CHAT_EMOJI_CATEGORIES', () => {
  it('has unique emoji within each tab', () => {
    for (const category of MEETING_CHAT_EMOJI_CATEGORIES) {
      expect(new Set(category.emojis).size).toBe(category.emojis.length)
    }
  })
})
