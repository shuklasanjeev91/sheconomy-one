/**
 * Web-specific meeting capability detection and user-facing copy.
 * Never throws — callers show understandable messages when a feature is missing.
 */

export type MeetingWebFeature =
  | 'camera'
  | 'microphone'
  | 'screen_share'
  | 'tab_share'
  | 'window_share'
  | 'fullscreen'
  | 'device_selection'
  | 'secure_context'

export type MeetingWebCapabilities = {
  /** Modern browsers require HTTPS (or localhost) for media. */
  secureContext: boolean
  getUserMedia: boolean
  getDisplayMedia: boolean
  enumerateDevices: boolean
  /** Audio output device switching via HTMLMediaElement.setSinkId. */
  setSinkId: boolean
  fullscreen: boolean
  /**
   * Chromium getDisplayMedia presents Screen / Window / Tab in one picker.
   * There is no discrete "supports tab only" API — this flags the picker path.
   */
  displaySurfacePicker: boolean
}

export function detectMeetingWebCapabilities(
  globalObject: typeof globalThis = globalThis,
): MeetingWebCapabilities {
  const nav = (globalObject as typeof globalThis & { navigator?: Navigator }).navigator
  const doc = (globalObject as typeof globalThis & { document?: Document }).document
  const media = nav?.mediaDevices
  const secureContext =
    typeof (globalObject as { isSecureContext?: boolean }).isSecureContext === 'boolean'
      ? !!(globalObject as { isSecureContext?: boolean }).isSecureContext
      : true

  const getUserMedia = !!media?.getUserMedia
  const getDisplayMedia = !!media?.getDisplayMedia
  const enumerateDevices = !!media?.enumerateDevices
  const setSinkId =
    typeof HTMLMediaElement !== 'undefined' &&
    typeof (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId === 'function'

  const fullscreen = !!(
    doc &&
    (doc.documentElement?.requestFullscreen ||
      (doc.documentElement as { webkitRequestFullscreen?: () => Promise<void> | void })
        ?.webkitRequestFullscreen)
  )

  return {
    secureContext,
    getUserMedia,
    getDisplayMedia,
    enumerateDevices,
    setSinkId,
    fullscreen,
    displaySurfacePicker: getDisplayMedia,
  }
}

export function meetingWebUnsupportedMessage(feature: MeetingWebFeature): string {
  switch (feature) {
    case 'secure_context':
      return 'Camera, microphone, and screen sharing need a secure connection (HTTPS). Open this meeting over https:// and try again.'
    case 'camera':
      return 'Camera is not available in this browser. Try Chrome, Edge, Firefox, or Safari on the latest version.'
    case 'microphone':
      return 'Microphone is not available in this browser. Try Chrome, Edge, Firefox, or Safari on the latest version.'
    case 'screen_share':
      return 'Screen sharing is not supported in this browser. Use Chrome or Edge, or update Safari / Firefox to the latest version.'
    case 'tab_share':
      return 'Browser tab sharing is not available here. Your browser may only offer the full screen or a window — pick one of those options in the share dialog.'
    case 'window_share':
      return 'Window sharing is not available here. Your browser may only offer a full screen or a browser tab — pick one of those options in the share dialog.'
    case 'fullscreen':
      return 'Full screen is not supported in this browser.'
    case 'device_selection':
      return 'Device selection is not supported in this browser. Use your system sound and camera settings instead.'
  }
}

export function mapWebMediaPermissionError(
  kind: 'camera' | 'microphone',
  cause?: unknown,
): string {
  const raw =
    cause instanceof Error
      ? `${cause.name} ${cause.message}`
      : typeof cause === 'string'
        ? cause
        : ''
  if (/NotAllowed|Permission|denied|SecurityError/i.test(raw)) {
    return kind === 'camera'
      ? 'Camera access is blocked. Allow camera in your browser site settings, then try again.'
      : 'Microphone access is blocked. Allow microphone in your browser site settings, then try again.'
  }
  if (/NotFound|DevicesNotFound|Overconstrained/i.test(raw)) {
    return kind === 'camera'
      ? 'No camera was found. Connect a camera and try again.'
      : 'No microphone was found. Connect a microphone and try again.'
  }
  if (/NotReadable|TrackStart|AbortError/i.test(raw)) {
    return kind === 'camera'
      ? 'Camera is in use by another app or tab. Close it and try again.'
      : 'Microphone is in use by another app or tab. Close it and try again.'
  }
  return kind === 'camera'
    ? meetingWebUnsupportedMessage('camera')
    : meetingWebUnsupportedMessage('microphone')
}

/**
 * Map getDisplayMedia / LiveKit screen-share failures to clear web copy.
 * The OS picker itself chooses Screen / Window / Browser tab when the browser supports them.
 */
export function mapWebScreenShareError(cause?: unknown): string {
  const raw =
    cause instanceof Error
      ? `${cause.name} ${cause.message}`
      : typeof cause === 'string'
        ? cause
        : ''
  if (/AbortError|canceled|cancelled/i.test(raw)) {
    return 'Screen share was cancelled. Choose Entire screen, Window, or Browser tab in the system picker when you try again.'
  }
  if (/NotAllowed|Permission|denied|SecurityError/i.test(raw)) {
    return 'Screen share permission was denied. Allow screen sharing when prompted, or enable it in your browser site settings.'
  }
  if (/NotSupported|undefined is not a function|getDisplayMedia/i.test(raw)) {
    return meetingWebUnsupportedMessage('screen_share')
  }
  if (/NotReadable|InvalidState/i.test(raw)) {
    return 'Could not capture that display. Try a different tab, window, or screen in the picker.'
  }
  if (raw.trim()) return raw.trim()
  return meetingWebUnsupportedMessage('screen_share')
}

export function meetingWebJoinBlocker(capabilities: MeetingWebCapabilities): string | null {
  if (!capabilities.secureContext) return meetingWebUnsupportedMessage('secure_context')
  if (!capabilities.getUserMedia) return meetingWebUnsupportedMessage('microphone')
  return null
}

export function describeMeetingWebScreenShare(capabilities: MeetingWebCapabilities): string {
  if (!capabilities.getDisplayMedia) return meetingWebUnsupportedMessage('screen_share')
  return 'When you share, your browser lets you pick Entire screen, a Window, or a Browser tab where supported.'
}
