import { describe, expect, it } from 'vitest'

import {
  canJoinMeetingWithoutCamera,
  canJoinMeetingWithoutNotifications,
  canJoinMeetingWithoutScreenShare,
  classifyMeetingAppStateInterruption,
  meetingMobileInterruptionNotice,
  meetingPermissionDenialMessage,
  softMediaToggleFailure,
} from '../../../co-work/lib/meeting-mobile'
import { meetingLifecycleNotice } from '../../../co-work/lib/meeting-lifecycle'

describe('meeting mobile requirements', () => {
  it('treats camera / notifications / screen share as optional for join', () => {
    expect(canJoinMeetingWithoutCamera(true)).toBe(true)
    expect(canJoinMeetingWithoutCamera(false)).toBe(false)
    expect(canJoinMeetingWithoutNotifications()).toBe(true)
    expect(canJoinMeetingWithoutScreenShare()).toBe(true)
  })

  it('returns safe denial copy without throwing', () => {
    expect(meetingPermissionDenialMessage('microphone', { blockedInSettings: true })).toMatch(
      /Settings/i,
    )
    expect(meetingPermissionDenialMessage('camera')).toMatch(/audio only/i)
    expect(meetingPermissionDenialMessage('notifications')).toMatch(/push|alert/i)
    expect(meetingPermissionDenialMessage('screen_broadcast')).toMatch(/sharing|capture/i)
    expect(meetingPermissionDenialMessage('bluetooth_audio')).toMatch(/Bluetooth|headset/i)
  })

  it('soft-fails media toggles on permission errors', () => {
    expect(softMediaToggleFailure('camera', new Error('NotAllowedError'))).toMatch(/Camera/i)
    expect(softMediaToggleFailure('microphone', new Error('Permission denied'))).toMatch(
      /Microphone/i,
    )
    expect(softMediaToggleFailure('speaker')).toMatch(/speaker|earpiece|Bluetooth/i)
  })

  it('classifies active→inactive as brief app interruption (not a phone call)', () => {
    expect(
      classifyMeetingAppStateInterruption({ previous: 'active', next: 'inactive' }),
    ).toBe('app_inactive')
    expect(
      classifyMeetingAppStateInterruption({ previous: 'active', next: 'background' }),
    ).toBe('none')
    expect(meetingMobileInterruptionNotice('phone_call')).toMatch(/Phone call/i)
    expect(meetingMobileInterruptionNotice('app_inactive')).toMatch(/stays connected|system UI/i)
  })

  it('surfaces phone-call interruption in lifecycle banner copy', () => {
    expect(
      meetingLifecycleNotice({
        platform: 'ios',
        inBackground: false,
        isSharingScreen: false,
        isViewingSharedScreen: false,
        intendedCameraOn: true,
        cameraEnabled: true,
        phoneCallInterrupted: true,
      }),
    ).toMatch(/Phone call/i)
  })
})
