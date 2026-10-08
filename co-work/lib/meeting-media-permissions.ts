import { Platform } from 'react-native'

import {
  meetingPermissionDenialMessage,
  type MeetingMobileDenial,
} from '~/co-work/lib/meeting-mobile'
import {
  detectMeetingWebCapabilities,
  mapWebMediaPermissionError,
  meetingWebJoinBlocker,
  meetingWebUnsupportedMessage,
  queryWebMediaPermission,
  releaseWebMediaStream,
  requestWebMicrophoneStream,
} from '~/co-work/lib/meeting-web'

export type MeetingMediaPermissionResult = {
  ok: boolean
  cameraGranted: boolean
  microphoneGranted: boolean
  notificationsGranted: boolean
  screenShareAvailable: boolean
  denials: MeetingMobileDenial[]
  message?: string
}

/**
 * Request optional camera / notifications and (on a user gesture) microphone before joining.
 * Must run from a user gesture on web; on native shows system permission sheets.
 *
 * Never throws. On web, microphone denial does not block join — callers should join muted
 * and let Unmute prompt. Camera, notifications, and screen share are always optional.
 */
/**
 * Ensure RECORD_AUDIO / mic permission before unmute on native.
 * Never throws — returns granted + copy for the banner when denied.
 */
export async function ensureNativeMicrophonePermission(): Promise<{
  granted: boolean
  blockedInSettings: boolean
  message?: string
}> {
  if (Platform.OS === 'web') {
    return { granted: true, blockedInSettings: false }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Camera } = require('expo-camera') as typeof import('expo-camera')
    const current = await Camera.getMicrophonePermissionsAsync()
    if (current.granted) {
      return { granted: true, blockedInSettings: false }
    }
    const requested = await Camera.requestMicrophonePermissionsAsync()
    if (requested.granted) {
      return { granted: true, blockedInSettings: false }
    }
    const blockedInSettings = requested.canAskAgain === false
    return {
      granted: false,
      blockedInSettings,
      message: meetingPermissionDenialMessage('microphone', { blockedInSettings }),
    }
  } catch (cause) {
    return {
      granted: false,
      blockedInSettings: false,
      message:
        cause instanceof Error
          ? cause.message
          : meetingPermissionDenialMessage('microphone'),
    }
  }
}

/**
 * Ensure camera permission before Start Video on native.
 * Joins may skip camera, so the live toggle must be able to prompt later.
 */
export async function ensureNativeCameraPermission(): Promise<{
  granted: boolean
  blockedInSettings: boolean
  message?: string
}> {
  if (Platform.OS === 'web') {
    return { granted: true, blockedInSettings: false }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Camera } = require('expo-camera') as typeof import('expo-camera')
    const current = await Camera.getCameraPermissionsAsync()
    if (current.granted) {
      return { granted: true, blockedInSettings: false }
    }
    const requested = await Camera.requestCameraPermissionsAsync()
    if (requested.granted) {
      return { granted: true, blockedInSettings: false }
    }
    const blockedInSettings = requested.canAskAgain === false
    return {
      granted: false,
      blockedInSettings,
      message: meetingPermissionDenialMessage('camera', { blockedInSettings }),
    }
  } catch (cause) {
    return {
      granted: false,
      blockedInSettings: false,
      message:
        cause instanceof Error
          ? cause.message
          : meetingPermissionDenialMessage('camera'),
    }
  }
}

export async function ensureMeetingMediaPermissions(): Promise<MeetingMediaPermissionResult> {
  return ensureMeetingMobilePermissions({ requestNotifications: false })
}

/** Honor pre-join mute/video prefs against what the browser actually granted. */
export function meetingJoinMediaFromPermissions(
  perms: MeetingMediaPermissionResult,
  preferred?: { audioEnabled?: boolean; videoEnabled?: boolean },
): { audioEnabled: boolean; videoEnabled: boolean } {
  return {
    audioEnabled: (preferred?.audioEnabled ?? true) && perms.microphoneGranted,
    videoEnabled: (preferred?.videoEnabled ?? true) && perms.cameraGranted,
  }
}

export async function ensureMeetingMobilePermissions(options?: {
  /** Soft-request push permission (denied = still ok to join). */
  requestNotifications?: boolean
  /** Web: skip getUserMedia when the user chose "Don't connect to audio". Default true. */
  requestMicrophone?: boolean
  /** Web: skip camera probe when the user chose "Turn off my video". Default true. */
  requestCamera?: boolean
}): Promise<MeetingMediaPermissionResult> {
  const denials: MeetingMobileDenial[] = []
  const requestNotifications = options?.requestNotifications ?? Platform.OS !== 'web'
  const requestMicrophone = options?.requestMicrophone ?? true
  const requestCamera = options?.requestCamera ?? true

  try {
    if (Platform.OS === 'web') {
      const capabilities = detectMeetingWebCapabilities()
      const joinBlocker = meetingWebJoinBlocker(capabilities)
      if (joinBlocker) {
        return {
          ok: false,
          cameraGranted: false,
          microphoneGranted: false,
          notificationsGranted: false,
          screenShareAvailable: capabilities.getDisplayMedia,
          denials: [
            {
              kind: 'microphone',
              message: joinBlocker,
              blockedInSettings: true,
            },
          ],
          message: joinBlocker,
        }
      }

      let microphoneGranted = false
      if (requestMicrophone) {
        try {
          const audioStream = await requestWebMicrophoneStream()
          microphoneGranted = true
          await releaseWebMediaStream(audioStream)
        } catch (cause) {
          const permissionState = await queryWebMediaPermission('microphone')
          const message = mapWebMediaPermissionError('microphone', cause, permissionState)
          denials.push({
            kind: 'microphone',
            message,
            blockedInSettings: permissionState === 'denied',
          })
        }
      }

      let cameraGranted = false
      if (requestCamera) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          cameraGranted = true
          await releaseWebMediaStream(videoStream)
        } catch (cause) {
          const permissionState = await queryWebMediaPermission('camera')
          denials.push({
            kind: 'camera',
            message: mapWebMediaPermissionError('camera', cause, permissionState),
            blockedInSettings: permissionState === 'denied',
          })
        }
      }

      const micDenial = denials.find((denial) => denial.kind === 'microphone')
      return {
        // Web can always join muted when getUserMedia exists — Zoom-style.
        ok: true,
        cameraGranted,
        microphoneGranted,
        notificationsGranted: false,
        screenShareAvailable: capabilities.getDisplayMedia,
        denials,
        message: microphoneGranted
          ? capabilities.getDisplayMedia
            ? undefined
            : meetingWebUnsupportedMessage('screen_share')
          : micDenial?.message,
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Camera } = require('expo-camera') as typeof import('expo-camera')
    let cameraGranted = false
    let microphoneGranted = false
    let micBlocked = false
    let camBlocked = false

    if (requestCamera) {
      try {
        const cam = await Camera.requestCameraPermissionsAsync()
        cameraGranted = !!cam.granted
        camBlocked = !cam.granted && cam.canAskAgain === false
      } catch {
        cameraGranted = false
      }
    } else {
      try {
        const cam = await Camera.getCameraPermissionsAsync()
        cameraGranted = !!cam.granted
        camBlocked = !cam.granted && cam.canAskAgain === false
      } catch {
        cameraGranted = false
      }
    }

    if (requestMicrophone) {
      try {
        const mic = await Camera.requestMicrophonePermissionsAsync()
        microphoneGranted = !!mic.granted
        micBlocked = !mic.granted && mic.canAskAgain === false
      } catch {
        microphoneGranted = false
      }
    } else {
      try {
        const mic = await Camera.getMicrophonePermissionsAsync()
        microphoneGranted = !!mic.granted
        micBlocked = !mic.granted && mic.canAskAgain === false
      } catch {
        microphoneGranted = false
      }
    }

    if (requestCamera && !cameraGranted) {
      denials.push({
        kind: 'camera',
        message: meetingPermissionDenialMessage('camera', { blockedInSettings: camBlocked }),
        blockedInSettings: camBlocked,
      })
    }

    if (requestMicrophone && !microphoneGranted) {
      const message = meetingPermissionDenialMessage('microphone', {
        blockedInSettings: micBlocked,
      })
      denials.push({
        kind: 'microphone',
        message,
        blockedInSettings: micBlocked,
      })
      return {
        ok: false,
        cameraGranted,
        microphoneGranted: false,
        notificationsGranted: false,
        screenShareAvailable: true,
        denials,
        message,
      }
    }

    // Join muted without a mic prompt — still ok; Unmute will request permission.
    if (!requestMicrophone && !microphoneGranted) {
      return {
        ok: true,
        cameraGranted,
        microphoneGranted: false,
        notificationsGranted: false,
        screenShareAvailable: true,
        denials,
        message: meetingPermissionDenialMessage('microphone', { blockedInSettings: micBlocked }),
      }
    }

    let notificationsGranted = false
    if (requestNotifications) {
      try {
        const push = (await import('~/lib/notifications/push-client')).default
        await push.init()
        notificationsGranted = await push.requestPermission()
        if (!notificationsGranted) {
          const canAsk = await push.canRequestPermission().catch(() => true)
          denials.push({
            kind: 'notifications',
            message: meetingPermissionDenialMessage('notifications', {
              blockedInSettings: !canAsk,
            }),
            blockedInSettings: !canAsk,
          })
        }
      } catch {
        denials.push({
          kind: 'notifications',
          message: meetingPermissionDenialMessage('notifications'),
          blockedInSettings: false,
        })
      }
    }

    return {
      ok: true,
      cameraGranted,
      microphoneGranted: true,
      notificationsGranted,
      screenShareAvailable: true,
      denials,
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not access camera and microphone. Please try again.'
    return {
      ok: false,
      cameraGranted: false,
      microphoneGranted: false,
      notificationsGranted: false,
      screenShareAvailable: Platform.OS !== 'web',
      denials: [
        {
          kind: 'microphone',
          message,
          blockedInSettings: false,
        },
      ],
      message,
    }
  }
}
