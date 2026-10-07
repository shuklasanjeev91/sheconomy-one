/** Zoom / Google Meet–style quick reactions for live Co-Work meetings. */

export const MEETING_REACTIONS = [
  { emoji: '👍', label: 'Thumbs up', toneable: true },
  { emoji: '👏', label: 'Clap', toneable: true },
  { emoji: '🙌', label: 'Cheer', toneable: true },
  { emoji: '🫶', label: 'Support', toneable: true },
  { emoji: '❤️', label: 'Heart', toneable: false },
  { emoji: '💪', label: 'Strong', toneable: true },
  { emoji: '👭', label: 'Together', toneable: false },
  { emoji: '😂', label: 'Laugh', toneable: false },
  { emoji: '😮', label: 'Surprised', toneable: false },
  { emoji: '🎉', label: 'Celebrate', toneable: false },
  { emoji: '✨', label: 'Inspired', toneable: false },
  { emoji: '🌟', label: 'Proud', toneable: false },
  { emoji: '🙏', label: 'Thanks', toneable: true },
  { emoji: '😢', label: 'Sad', toneable: false },
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

/** Floating emoji lifetime — auto-clears; no second tap required. */
export const MEETING_REACTION_TTL_MS = 2800

const TONEABLE = new Set(
  MEETING_REACTIONS.filter((row) => row.toneable).map((row) => row.emoji as string),
)

/** Apply a Fitzpatrick modifier to toneable base emojis. */
export function applyMeetingReactionTone(emoji: string, tone: string | undefined): string {
  const base = String(emoji || '')
  const modifier = String(tone || '')
  if (!base || !modifier || !TONEABLE.has(base)) return base
  // Strip an existing tone modifier if present, then append.
  const stripped = base.replace(/[\u{1F3FB}-\u{1F3FF}]$/u, '')
  return `${stripped}${modifier}`
}
