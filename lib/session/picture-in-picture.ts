import { Platform } from 'react-native'

import { androidPipSupported, enterAndroidPip } from '~/lib/session/android-pip'

/**
 * Picture-in-Picture capability detection and user-facing copy.
 * Android: Activity PiP (no foreground service) when the device supports it.
 */

export type SessionPipCapabilities = {
  supported: boolean
  mode: 'document' | 'video' | 'native_avkit' | 'native_activity' | 'none'
  unsupportedMessage: string | null
}

export function detectSessionPipCapabilities(
  platform: typeof Platform.OS = Platform.OS,
): SessionPipCapabilities {
  if (platform === 'android') {
    if (platform === Platform.OS && androidPipSupported()) {
      return { supported: true, mode: 'native_activity', unsupportedMessage: null }
    }
    return {
      supported: false,
      mode: 'none',
      unsupportedMessage:
        'Picture-in-Picture is not available on this Android device. Use Minimize to keep the session while you browse inside the app, then return to see video.',
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
 * iOS: AVKit via the registered RTCView. Android: Activity PiP of the whole window.
 */
export async function requestSessionPictureInPicture(
  videoSelector?: string,
): Promise<{ ok: boolean; message?: string }> {
  const caps = detectSessionPipCapabilities()
  if (Platform.OS === 'web') {
    return requestWebSessionPictureInPicture(videoSelector)
  }
  if (!caps.supported) {
    return { ok: false, message: sessionPipUnsupportedMessage(caps) }
  }
  if (Platform.OS === 'android') {
    const entered = await enterAndroidPip()
    return entered
      ? { ok: true }
      : { ok: false, message: 'Could not start Picture-in-Picture. Try again, or use Minimize.' }
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
