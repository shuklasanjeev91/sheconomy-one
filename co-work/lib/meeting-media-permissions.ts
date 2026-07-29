import { Platform } from 'react-native'

export type MeetingMediaPermissionResult = {
  ok: boolean
  cameraGranted: boolean
  microphoneGranted: boolean
  message?: string
}

/**
 * Ask for camera + microphone before joining a Co-Work room.
 * Must run from a user gesture on web; on native shows system permission sheets.
 *
 * Web uses getUserMedia only (no expo-camera import — the web stub used to omit
 * `Camera` and blanked the Co-Work tab). Native uses sync require to avoid a
 * Hermes-hostile async chunk for permissions alone.
 */
export async function ensureMeetingMediaPermissions(): Promise<MeetingMediaPermissionResult> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return {
          ok: false,
          cameraGranted: false,
          microphoneGranted: false,
          message: 'Camera and microphone are not available in this browser.',
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return { ok: true, cameraGranted: true, microphoneGranted: true }
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Camera } = require('expo-camera') as typeof import('expo-camera')
    const cam = await Camera.requestCameraPermissionsAsync()
    const mic = await Camera.requestMicrophonePermissionsAsync()
    const cameraGranted = !!cam.granted
    const microphoneGranted = !!mic.granted

    if (!cameraGranted || !microphoneGranted) {
      const blocked = (!cameraGranted && !cam.canAskAgain) || (!microphoneGranted && !mic.canAskAgain)
      return {
        ok: false,
        cameraGranted,
        microphoneGranted,
        message: blocked
          ? 'Camera or microphone access is blocked. Enable it in Settings → SHEconomy, then try again.'
          : 'Camera and microphone permission is required to start a meeting.',
      }
    }

    return { ok: true, cameraGranted: true, microphoneGranted: true }
  } catch (error) {
    return {
      ok: false,
      cameraGranted: false,
      microphoneGranted: false,
      message:
        error instanceof Error
          ? error.message
          : 'Could not access camera and microphone. Please try again.',
    }
  }
}
