import type { Meeting, MeetingSecuritySettings } from '~/co-work/lib/types'

/** User-facing copy when the host has locked the meeting. */
export const MEETING_LOCKED_MESSAGE =
  'This meeting is locked. New participants cannot join until the host unlocks it.'

export function meetingRequiresPasscode(
  security: MeetingSecuritySettings | null | undefined,
): boolean {
  if (!security) return false
  return !!(security.requirePasscode || security.passcode?.trim())
}

/** Hosts skip the lobby passcode prompt — they already own the room. */
export function shouldPromptForPasscode(input: {
  security: MeetingSecuritySettings | null | undefined
  isHost: boolean
}): boolean {
  if (input.isHost) return false
  return meetingRequiresPasscode(input.security)
}

/**
 * Map RPC / join errors to friendly meeting-security messages.
 * Returns null when the error is unrelated to security gates.
 */
export function mapMeetingSecurityJoinError(message: string): string | null {
  if (/MEETING_LOCKED/i.test(message)) return MEETING_LOCKED_MESSAGE
  if (/MEETING_FULL/i.test(message)) {
    return 'This meeting is full. Ask the host to raise the participant limit or try again later.'
  }
  if (/PARTICIPANT_REMOVED/i.test(message)) {
    return 'You were removed from this meeting. Ask the host to allow you to rejoin.'
  }
  if (/MEETING_CANCELLED/i.test(message)) return 'The host cancelled this meeting.'
  if (/INVALID_PASSCODE|PASSCODE_REQUIRED/i.test(message)) {
    return 'Enter the correct meeting passcode to join.'
  }
  return null
}

export function lockMeetingConfirmCopy(locked: boolean) {
  if (locked) {
    return {
      title: 'Unlock meeting?',
      message: 'New participants will be able to join again (subject to waiting room and passcode).',
      confirmLabel: 'Unlock',
    } as const
  }
  return {
    title: 'Lock meeting?',
    message: 'New participants will not be able to join until you unlock the meeting.',
    confirmLabel: 'Lock Meeting',
  } as const
}

export function describeMeetingSecurity(meeting: Pick<Meeting, 'security_settings'> & {
  isLocked?: boolean | null
}) {
  return {
    hasPasscode: meetingRequiresPasscode(meeting.security_settings),
    waitingRoom: meeting.security_settings?.waitingRoom !== false,
    isLocked: !!meeting.isLocked,
  }
}
