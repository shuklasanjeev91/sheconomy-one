/**
 * Cross-platform meeting background / foreground lifecycle copy.
 *
 * Be honest about OS limits: mobile camera is typically paused while the app is
 * backgrounded. Do not claim unsupported background-camera behavior.
 */

export type MeetingLifecyclePlatform = 'web' | 'ios' | 'android'

export type MeetingLifecycleSnapshot = {
  platform: MeetingLifecyclePlatform
  /** App / tab is not foreground-visible. */
  inBackground: boolean
  /** Local participant is publishing a screen share. */
  isSharingScreen: boolean
  /** Local participant is viewing someone else's screen share. */
  isViewingSharedScreen: boolean
  /** User wants camera on (last known intent before OS paused it). */
  intendedCameraOn: boolean
  /** The SFU reports the local camera track as enabled. */
  cameraEnabled: boolean
  /** Screen share ended while we were backgrounded / tab-hidden. */
  screenShareStoppedByOs?: boolean
  /** Network / SFU reconnect in progress. */
  reconnecting?: boolean
  /** Restoring media after returning to the app. */
  restoring?: boolean
  /** Native phone call / system audio interruption (iOS inactive, audio focus). */
  phoneCallInterrupted?: boolean
}

export type MeetingScreenShareRole = 'sharing' | 'viewing' | 'none'

export function meetingScreenShareRole(input: {
  isSharingScreen: boolean
  isViewingSharedScreen: boolean
}): MeetingScreenShareRole {
  if (input.isSharingScreen) return 'sharing'
  if (input.isViewingSharedScreen) return 'viewing'
  return 'none'
}

export function screenShareRoleLabel(role: MeetingScreenShareRole): string | null {
  if (role === 'sharing') return 'You’re sharing your screen · Others can see it'
  if (role === 'viewing') return 'You’re viewing a shared screen'
  return null
}

/** In-app minimize (WhatsApp-style floating bubble) — not OS background. */
export function meetingBrowsingMinimizedNotice(kind: 'meeting' | 'call' = 'meeting'): string {
  return kind === 'call'
    ? 'Floating bubble stays on screen — tap it to return to the call.'
    : 'Floating bubble stays on screen — tap it to return to the meeting.'
}

export function meetingBackgroundNotice(snapshot: MeetingLifecycleSnapshot): string {
  const role = meetingScreenShareRole(snapshot)

  if (snapshot.platform === 'web') {
    if (role === 'sharing') {
      return 'Sharing continues while this tab is in the background. Meeting stays connected.'
    }
    if (role === 'viewing') {
      return 'Viewing shared screen · Tab is in the background. Meeting stays connected.'
    }
    return 'Meeting remains connected while this tab is in the background.'
  }

  // Native: never promise background camera.
  if (role === 'sharing') {
    if (snapshot.platform === 'ios') {
      return 'You’re sharing via the system broadcast. Camera is paused in the background; audio continues when iOS allows it.'
    }
    return 'You’re sharing your screen. Capture may stop if Android ends the broadcast. Camera is paused in the background.'
  }

  if (role === 'viewing') {
    return 'You’re viewing a shared screen. Camera is paused while Sheconomy is in the background; audio continues when the OS allows it.'
  }

  return 'Meeting stays connected. Camera is paused while Sheconomy is in the background; audio continues when the OS allows it.'
}

export function meetingLifecycleNotice(snapshot: MeetingLifecycleSnapshot): string | null {
  if (snapshot.reconnecting) {
    return 'Connection interrupted · reconnecting automatically…'
  }
  if (snapshot.phoneCallInterrupted) {
    return 'Phone call in progress · meeting audio is paused until the call ends'
  }
  if (snapshot.restoring) {
    return 'Back in Sheconomy · restoring audio and camera…'
  }
  if (snapshot.screenShareStoppedByOs) {
    if (snapshot.platform === 'web') {
      return 'Screen share stopped · the browser or system ended the broadcast'
    }
    return 'Screen broadcast was stopped by the operating system'
  }
  if (
    !snapshot.inBackground &&
    snapshot.intendedCameraOn &&
    !snapshot.cameraEnabled
  ) {
    return 'Camera was paused by the operating system · tap Camera to turn it back on'
  }
  if (snapshot.inBackground) {
    return meetingBackgroundNotice(snapshot)
  }
  return null
}

/**
 * Decide whether returning to the foreground should attempt to re-enable the
 * local camera. Only when the user had camera on before backgrounding.
 */
export function shouldRestoreCameraAfterForeground(input: {
  intendedCameraOn: boolean
  cameraEnabled: boolean
  mediaAllowsCamera: boolean
}): boolean {
  return input.mediaAllowsCamera && input.intendedCameraOn && !input.cameraEnabled
}
