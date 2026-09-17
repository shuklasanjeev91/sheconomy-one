import { describe, expect, it } from 'vitest'

import {
  meetingBackgroundNotice,
  meetingBrowsingMinimizedNotice,
  meetingLifecycleNotice,
  meetingScreenShareRole,
  screenShareRoleLabel,
  shouldRestoreCameraAfterForeground,
} from '~/co-work/lib/meeting-lifecycle'

describe('meeting lifecycle', () => {
  it('distinguishes sharing vs viewing vs none', () => {
    expect(meetingScreenShareRole({ isSharingScreen: true, isViewingSharedScreen: true })).toBe(
      'sharing',
    )
    expect(meetingScreenShareRole({ isSharingScreen: false, isViewingSharedScreen: true })).toBe(
      'viewing',
    )
    expect(meetingScreenShareRole({ isSharingScreen: false, isViewingSharedScreen: false })).toBe(
      'none',
    )
  })

  it('labels sharing and viewing clearly', () => {
    expect(screenShareRoleLabel('sharing')).toMatch(/sharing your screen/i)
    expect(screenShareRoleLabel('viewing')).toMatch(/viewing a shared screen/i)
    expect(screenShareRoleLabel('none')).toBeNull()
  })

  it('does not promise background camera on native', () => {
    const ios = meetingBackgroundNotice({
      platform: 'ios',
      inBackground: true,
      isSharingScreen: false,
      isViewingSharedScreen: false,
      intendedCameraOn: true,
      cameraEnabled: false,
    })
    expect(ios).toMatch(/camera is paused/i)
    expect(ios).not.toMatch(/camera continues/i)

    const androidShare = meetingBackgroundNotice({
      platform: 'android',
      inBackground: true,
      isSharingScreen: true,
      isViewingSharedScreen: false,
      intendedCameraOn: false,
      cameraEnabled: false,
    })
    expect(androidShare).toMatch(/camera is paused/i)
    expect(androidShare).toMatch(/may stop/i)
  })

  it('keeps web tab-background messaging accurate for share roles', () => {
    expect(
      meetingBackgroundNotice({
        platform: 'web',
        inBackground: true,
        isSharingScreen: true,
        isViewingSharedScreen: false,
        intendedCameraOn: true,
        cameraEnabled: true,
      }),
    ).toMatch(/Sharing continues/i)

    expect(
      meetingBackgroundNotice({
        platform: 'web',
        inBackground: true,
        isSharingScreen: false,
        isViewingSharedScreen: true,
        intendedCameraOn: false,
        cameraEnabled: false,
      }),
    ).toMatch(/Viewing shared screen/i)
  })

  it('surfaces OS-stopped broadcast and paused camera status', () => {
    expect(
      meetingLifecycleNotice({
        platform: 'ios',
        inBackground: false,
        isSharingScreen: false,
        isViewingSharedScreen: false,
        intendedCameraOn: true,
        cameraEnabled: true,
        screenShareStoppedByOs: true,
      }),
    ).toMatch(/stopped by the operating system/i)

    expect(
      meetingLifecycleNotice({
        platform: 'android',
        inBackground: false,
        isSharingScreen: false,
        isViewingSharedScreen: false,
        intendedCameraOn: true,
        cameraEnabled: false,
      }),
    ).toMatch(/paused by the operating system/i)
  })

  it('restores camera only when the user intended it on', () => {
    expect(
      shouldRestoreCameraAfterForeground({
        intendedCameraOn: true,
        cameraEnabled: false,
        mediaAllowsCamera: true,
      }),
    ).toBe(true)
    expect(
      shouldRestoreCameraAfterForeground({
        intendedCameraOn: false,
        cameraEnabled: false,
        mediaAllowsCamera: true,
      }),
    ).toBe(false)
    expect(
      shouldRestoreCameraAfterForeground({
        intendedCameraOn: true,
        cameraEnabled: false,
        mediaAllowsCamera: false,
      }),
    ).toBe(false)
  })

  it('explains in-app browsing while minimized', () => {
    expect(meetingBrowsingMinimizedNotice('meeting')).toMatch(/browse Sheconomy/i)
    expect(meetingBrowsingMinimizedNotice('call')).toMatch(/Call continues/i)
  })
})
