import { Platform } from 'react-native'
import { CALL_AUDIO_CAPTURE } from '~/co-work/lib/livekit-call-audio'

export type MeetingMediaPermissionResult = {
  ok: boolean
  cameraGranted: boolean
  microphoneGranted: boolean
  message?: string
}

/**
 * Require microphone access and request optional camera access before joining.
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
      let microphoneGranted = false
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { ...CALL_AUDIO_CAPTURE },
          video: false,
        })
        microphoneGranted = true
        audioStream.getTracks().forEach((track) => track.stop())
      } catch (cause) {
        const blocked =
          cause instanceof Error && /NotAllowed|Permission|denied/i.test(cause.name + cause.message)
        return {
          ok: false,
          cameraGranted: false,
          microphoneGranted: false,
          message: blocked
            ? 'Microphone access is blocked. Allow it in your browser site settings and try again.'
            : 'No working microphone was found. Check your audio device and try again.',
        }
      }

      let cameraGranted = false
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        cameraGranted = true
        videoStream.getTracks().forEach((track) => track.stop())
      } catch {
        // Camera is optional: users can still join with clear audio.
      }
      return { ok: microphoneGranted, cameraGranted, microphoneGranted }
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Camera } = require('expo-camera') as typeof import('expo-camera')
    const cam = await Camera.requestCameraPermissionsAsync()
    const mic = await Camera.requestMicrophonePermissionsAsync()
    const cameraGranted = !!cam.granted
    const microphoneGranted = !!mic.granted

    if (!microphoneGranted) {
      return {
        ok: false,
        cameraGranted,
        microphoneGranted,
        message: !mic.canAskAgain
          ? 'Microphone access is blocked. Enable it in Settings → SHEconomy, then try again.'
          : 'Microphone permission is required to join with audio.',
      }
    }

    // Camera permission is optional; LiveKit joins audio-first when it is denied.
    return { ok: true, cameraGranted, microphoneGranted: true }
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
