import { Platform } from 'react-native'

/**
 * Picture-in-Picture capability detection and user-facing copy.
 * Android: no FGS overlay — in-app mini-player only.
 */

export type SessionPipCapabilities = {
  supported: boolean
  mode: 'document' | 'video' | 'native_avkit' | 'none'
  unsupportedMessage: string | null
}

export function detectSessionPipCapabilities(
  platform: typeof Platform.OS = Platform.OS,
): SessionPipCapabilities {
  if (platform === 'android') {
    return {
      supported: false,
      mode: 'none',
      unsupportedMessage:
        'Picture-in-Picture over other apps is not available on Android in Sheconomy. Use Minimize to keep the session while you browse inside the app, then return to see video.',
    }
  }

  if (platform === 'ios') {
    return {
      supported: true,
      mode: 'native_avkit',
      unsupportedMessage: null,
    }
  }

  // Web — refined in .web.ts; default assumes modern Chromium Document PiP probe later.
  return {
    supported: false,
    mode: 'none',
    unsupportedMessage:
      'Picture-in-Picture is not supported in this browser. Use Minimize to keep browsing Sheconomy with the session running.',
  }
}

export function sessionPipUnsupportedMessage(capabilities: SessionPipCapabilities): string {
  return (
    capabilities.unsupportedMessage ||
    'Picture-in-Picture is not available on this device.'
  )
}

/** Web-only — native stub. */
export async function requestWebSessionPictureInPicture(
  _videoSelector?: string,
): Promise<{ ok: boolean; message?: string }> {
  const caps = detectSessionPipCapabilities()
  return { ok: false, message: sessionPipUnsupportedMessage(caps) }
}

/** Web-only — native stub. */
export async function exitWebSessionPictureInPicture(): Promise<void> {}

/**
 * Enter OS / in-app Picture-in-Picture for the current platform.
 * iOS: LiveKit AVKit via registered VideoTrack. Android: unsupported (mini-player only).
 */
export async function requestSessionPictureInPicture(
  videoSelector?: string,
): Promise<{ ok: boolean; message?: string }> {
  const caps = detectSessionPipCapabilities()
  if (Platform.OS === 'web') {
    return requestWebSessionPictureInPicture(videoSelector)
  }
  if (Platform.OS === 'android' || !caps.supported) {
    return { ok: false, message: sessionPipUnsupportedMessage(caps) }
  }
  try {
    const { startRegisteredIosPip } = require('~/lib/session/ios-pip-registry') as {
      startRegisteredIosPip: () => Promise<void>
    }
    await startRegisteredIosPip()
    return { ok: true }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error
          ? cause.message
          : 'Could not start Picture-in-Picture. Keep a video tile visible, then try again.',
    }
  }
}

export async function exitSessionPictureInPicture(): Promise<void> {
  if (Platform.OS === 'web') {
    await exitWebSessionPictureInPicture()
    return
  }
  if (Platform.OS === 'ios') {
    try {
      const { stopRegisteredIosPip } = require('~/lib/session/ios-pip-registry') as {
        stopRegisteredIosPip: () => Promise<void>
      }
      await stopRegisteredIosPip()
    } catch {
      // Best-effort.
    }
  }
}
