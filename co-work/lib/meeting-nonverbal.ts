/** Zoom-style nonverbal feedback (sticky status under the video tile). */

export const MEETING_NONVERBAL_STATUSES = [
  { id: 'yes', label: 'Yes', emoji: '✅' },
  { id: 'no', label: 'No', emoji: '❌' },
  { id: 'slow', label: 'Go slower', emoji: '🐢' },
  { id: 'faster', label: 'Go faster', emoji: '🐇' },
  { id: 'break', label: 'Need a break', emoji: '☕' },
  { id: 'away', label: 'Away', emoji: '🚶' },
] as const

export type MeetingNonverbalStatusId = (typeof MEETING_NONVERBAL_STATUSES)[number]['id']

export function isMeetingNonverbalStatusId(value: unknown): value is MeetingNonverbalStatusId {
  return MEETING_NONVERBAL_STATUSES.some((row) => row.id === value)
}

export function meetingNonverbalLabel(status: MeetingNonverbalStatusId | null | undefined): string {
  if (!status) return ''
  return MEETING_NONVERBAL_STATUSES.find((row) => row.id === status)?.label ?? ''
}

export function meetingNonverbalEmoji(status: MeetingNonverbalStatusId | null | undefined): string {
  if (!status) return ''
  return MEETING_NONVERBAL_STATUSES.find((row) => row.id === status)?.emoji ?? ''
}

/** Clear after this many ms unless refreshed (Zoom clears sticky feedback on clear). */
export const MEETING_NONVERBAL_TTL_MS = 5 * 60_000
