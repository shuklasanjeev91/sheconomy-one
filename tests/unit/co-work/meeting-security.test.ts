import { describe, expect, it } from 'vitest'

import {
  describeMeetingSecurity,
  lockMeetingConfirmCopy,
  mapMeetingSecurityJoinError,
  MEETING_LOCKED_MESSAGE,
  meetingRequiresPasscode,
  shouldPromptForPasscode,
} from '~/co-work/lib/meeting-security'

describe('meeting security helpers', () => {
  it('detects optional passcode requirements', () => {
    expect(meetingRequiresPasscode(null)).toBe(false)
    expect(meetingRequiresPasscode({ waitingRoom: true })).toBe(false)
    expect(meetingRequiresPasscode({ requirePasscode: true })).toBe(true)
    expect(meetingRequiresPasscode({ passcode: 'secret' })).toBe(true)
  })

  it('skips the passcode prompt for hosts', () => {
    expect(
      shouldPromptForPasscode({
        security: { passcode: 'secret' },
        isHost: true,
      }),
    ).toBe(false)
    expect(
      shouldPromptForPasscode({
        security: { passcode: 'secret' },
        isHost: false,
      }),
    ).toBe(true)
  })

  it('maps lock / remove / cancel join errors', () => {
    expect(mapMeetingSecurityJoinError('MEETING_LOCKED')).toBe(MEETING_LOCKED_MESSAGE)
    expect(mapMeetingSecurityJoinError('PARTICIPANT_REMOVED')).toMatch(/removed/)
    expect(mapMeetingSecurityJoinError('MEETING_CANCELLED')).toMatch(/cancelled/)
    expect(mapMeetingSecurityJoinError('something else')).toBeNull()
  })

  it('uses Lock Meeting confirm copy', () => {
    expect(lockMeetingConfirmCopy(false).confirmLabel).toBe('Lock Meeting')
    expect(lockMeetingConfirmCopy(true).confirmLabel).toBe('Unlock')
  })

  it('summarizes security badges', () => {
    expect(
      describeMeetingSecurity({
        security_settings: { waitingRoom: true, passcode: 'x' },
        isLocked: true,
      }),
    ).toEqual({
      hasPasscode: true,
      waitingRoom: true,
      isLocked: true,
    })
  })
})
