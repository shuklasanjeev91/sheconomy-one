/** Zoom / Google Meet–style quick reactions for live Co-Work meetings. */
export const MEETING_REACTIONS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '😮', label: 'Surprised' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '🙏', label: 'Thanks' },
  { emoji: '😢', label: 'Sad' },
] as const

export type MeetingReactionEmoji = (typeof MEETING_REACTIONS)[number]['emoji']

export type FloatingMeetingReaction = {
  id: string
  emoji: string
  from: string
  name: string
  createdAt: number
  /** Horizontal offset 0–100 for scatter. */
  lane: number
}

export const MEETING_REACTION_TTL_MS = 3200
