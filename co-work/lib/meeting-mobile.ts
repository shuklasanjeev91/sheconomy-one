import { ANDROID_PRESENT_UNAVAILABLE_MESSAGE } from '~/co-work/lib/android-present-build'

/**
 * Mobile-specific meeting requirements helpers (Android / iOS).
 * Pure policy + copy — never throws; callers must treat denials as soft failures.
 */

export type MeetingMobilePermissionKind =
  | 'camera'
  | 'microphone'
  | 'notifications'
  | 'screen_broadcast'
  | 'bluetooth_audio'

export type MeetingMobileDenial = {
  kind: MeetingMobilePermissionKind
  /** User-facing guidance — safe to show in toasts / join errors. */
  message: string
  /** True when the OS will not show another system prompt. */
  blockedInSettings: boolean
}

/** Stable copy for permission denials — never throw these as uncaught errors. */
export function meetingPermissionDenialMessage(
  kind: MeetingMobilePermissionKind,
  options?: { blockedInSettings?: boolean },
): string {
  const blocked = !!options?.blockedInSettings
  switch (kind) {
    case 'microphone':
      return blocked
        ? 'Microphone access is blocked. Enable it in Settings → SHEconomy, then try again.'
        : 'Allow microphone access to unmute and speak in this meeting.'
    case 'camera':
      return blocked
        ? 'Camera access is blocked. Enable it in Settings → SHEconomy to show video.'
        : 'Camera permission was denied. You can still join with audio only.'
    case 'notifications':
      return blocked
        ? 'Notifications are blocked. Enable them in Settings to get meeting alerts.'
        : 'Notification permission was denied. You will not get meeting push alerts on this device.'
    case 'screen_broadcast':
      return blocked
        ? 'Screen sharing is unavailable. Allow screen capture when prompted, or rebuild the app if the broadcast extension is missing.'
        : 'Screen share was cancelled or denied. You can keep meeting without sharing.'
    case 'bluetooth_audio':
      return blocked
        ? 'Bluetooth audio access is blocked. Enable Nearby devices / Bluetooth for SHEconomy in Settings.'
        : 'Bluetooth headset could not be used. Continuing on speaker or earpiece.'
  }
}

export function canJoinMeetingWithoutCamera(microphoneGranted: boolean): boolean {
  return microphoneGranted
}

export function canJoinMeetingWithoutNotifications(): true {
  return true
}

export function canJoinMeetingWithoutScreenShare(): true {
  return true
}

/**
 * Soft failure result for native media toggles — never escalate to a crash.
 */
export function softMediaToggleFailure(
  action: 'microphone' | 'camera' | 'screen_share' | 'speaker',
  cause?: unknown,
  options?: { blockedInSettings?: boolean },
): string {
  const raw = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : ''
  const blockedInSettings = !!options?.blockedInSettings
  if (
    blockedInSettings ||
    /NotAllowed|Permission|denied|unauthorized|RECORD_AUDIO/i.test(raw)
  ) {
    if (action === 'microphone') {
      return meetingPermissionDenialMessage('microphone', { blockedInSettings })
    }
    if (action === 'camera') {
      return meetingPermissionDenialMessage('camera', { blockedInSettings })
    }
    if (action === 'screen_share') {
      return meetingPermissionDenialMessage('screen_broadcast', { blockedInSettings })
    }
  }
  if (action === 'speaker') {
    return 'Could not switch speaker / earpiece. Check Bluetooth permissions if using a headset.'
  }
  if (action === 'screen_share') {
    if (
      raw === ANDROID_PRESENT_UNAVAILABLE_MESSAGE ||
      /without video frames|did not start|MediaProjection|foreground|build 17/i.test(raw)
    ) {
      return raw
    }
    return meetingPermissionDenialMessage('screen_broadcast')
  }
  if (action === 'camera') {
    return 'Could not toggle camera. Check camera permission in Settings.'
  }
  return 'Could not change microphone state. Check microphone permission and try again.'
}

export type MeetingMobileInterruptionKind =
  | 'phone_call'
  | 'audio_focus'
  | 'app_inactive'
  | 'network'
  | 'none'

export function meetingMobileInterruptionNotice(
  kind: MeetingMobileInterruptionKind,
): string | null {
  switch (kind) {
    case 'phone_call':
      return 'Phone call in progress · meeting audio is paused until the call ends'
    case 'audio_focus':
      return 'Another app took audio focus · meeting audio will resume when available'
    case 'app_inactive':
      return 'Meeting stays connected · audio may pause briefly while another system UI is open'
    case 'network':
      return 'Connection interrupted · reconnecting automatically…'
    case 'none':
      return null
  }
}

export const MEETING_BACKGROUND_CAMERA_PAUSE_DEBOUNCE_MS = 1_200

/**
 * Android camera / mic permission sheets often flip AppState to `background`
 * for under a second. Pausing the camera immediately shows a false
 * "Camera is paused while Sheconomy is in the background" banner and fights
 * the Start Video tap. Debounce so only a sustained background pauses media.
 */
export function shouldConfirmNativeBackgroundPause(
  stillBackground: boolean,
  elapsedMs: number,
  debounceMs = MEETING_BACKGROUND_CAMERA_PAUSE_DEBOUNCE_MS,
): boolean {
  return stillBackground && elapsedMs >= debounceMs
}

/** Classify AppState transitions for interruption UX.
 * active→inactive is Control Center / app switcher / incoming call UI — not
 * a confirmed phone call. Treat as brief app_inactive so we don't flash a
 * "Phone call in progress" banner for every system sheet.
 */
export function classifyMeetingAppStateInterruption(input: {
  previous: string
  next: string
}): MeetingMobileInterruptionKind {
  if (input.next === 'inactive' && input.previous === 'active') {
    return 'app_inactive'
  }
  if (input.next === 'background') {
    return 'none' // background notice handled separately
  }
  if (input.next === 'active') {
    return 'none'
  }
  return 'app_inactive'
}
