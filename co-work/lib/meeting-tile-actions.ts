/**
 * Zoom-style per-tile menu actions (pin / spotlight / lower hand).
 */

export type MeetingTileActionKey =
  | 'pin'
  | 'unpin'
  | 'spotlight'
  | 'remove_spotlight'
  | 'lower_hand'

export function meetingTileMenuActions(input: {
  isSelf: boolean
  isScreen?: boolean
  canModerate: boolean
  isPinned: boolean
  isSpotlighted: boolean
  handRaised: boolean
}): MeetingTileActionKey[] {
  if (input.isScreen) return []
  const actions: MeetingTileActionKey[] = []

  // Anyone can pin/unpin locally (including self).
  actions.push(input.isPinned ? 'unpin' : 'pin')

  if (input.canModerate && !input.isSelf) {
    actions.push(input.isSpotlighted ? 'remove_spotlight' : 'spotlight')
    if (input.handRaised) actions.push('lower_hand')
  }

  return actions
}

/** Participants dock badge: waiting room urgency > raised hands > headcount. */
export function resolveParticipantsToolbarBadge(input: {
  waitingCount?: number
  raisedHandCount?: number
  participantCount?: number
}): number {
  const waiting = Math.max(0, input.waitingCount ?? 0)
  if (waiting > 0) return waiting
  const hands = Math.max(0, input.raisedHandCount ?? 0)
  if (hands > 0) return hands
  return Math.max(0, input.participantCount ?? 0)
}

export function meetingTileActionLabel(key: MeetingTileActionKey): string {
  switch (key) {
    case 'pin':
      return 'Pin'
    case 'unpin':
      return 'Unpin'
    case 'spotlight':
      return 'Spotlight for everyone'
    case 'remove_spotlight':
      return 'Remove spotlight'
    case 'lower_hand':
      return 'Lower hand'
  }
}
