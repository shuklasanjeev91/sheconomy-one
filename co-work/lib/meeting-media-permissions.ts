import { Platform } from 'react-native'

import { CALL_AUDIO_CAPTURE } from '~/co-work/lib/livekit-call-audio'
import {
  meetingPermissionDenialMessage,
  type MeetingMobileDenial,
} from '~/co-work/lib/meeting-mobile'
import {
  detectMeetingWebCapabilities,
  mapWebMediaPermissionError,
  meetingWebJoinBlocker,
  meetingWebUnsupportedMessage,
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
 * Require microphone access and request optional camera / notifications before joining.
 * Must run from a user gesture on web; on native shows system permission sheets.
 *
 * Never throws. Camera, notifications, and screen share are optional — denial never
 * crashes the app and never blocks an audio-capable join.
 */
export async function ensureMeetingMediaPermissions(): Promise<MeetingMediaPermissionResult> {
  return ensureMeetingMobilePermissions({ requestNotifications: false })
}

export async function ensureMeetingMobilePermissions(options?: {
  /** Soft-request push permission (denied = still ok to join). */
  requestNotifications?: boolean
}): Promise<MeetingMediaPermissionResult> {
  const denials: MeetingMobileDenial[] = []
  const requestNotifications = options?.requestNotifications ?? Platform.OS !== 'web'

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
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { ...CALL_AUDIO_CAPTURE },
          video: false,
        })
        microphoneGranted = true
        audioStream.getTracks().forEach((track) => track.stop())
      } catch (cause) {
        const message = mapWebMediaPermissionError('microphone', cause)
        const blocked = /blocked|site settings/i.test(message)
        denials.push({ kind: 'microphone', message, blockedInSettings: blocked })
        return {
          ok: false,
          cameraGranted: false,
          microphoneGranted: false,
          notificationsGranted: false,
          screenShareAvailable: capabilities.getDisplayMedia,
          denials,
          message,
        }
      }

      let cameraGranted = false
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        cameraGranted = true
        videoStream.getTracks().forEach((track) => track.stop())
      } catch (cause) {
        denials.push({
          kind: 'camera',
          message: mapWebMediaPermissionError('camera', cause),
          blockedInSettings: false,
        })
      }

      return {
        ok: microphoneGranted,
        cameraGranted,
        microphoneGranted,
        notificationsGranted: false,
        screenShareAvailable: capabilities.getDisplayMedia,
        denials,
        message: capabilities.getDisplayMedia
          ? undefined
          : meetingWebUnsupportedMessage('screen_share'),
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Camera } = require('expo-camera') as typeof import('expo-camera')
    let cameraGranted = false
    let microphoneGranted = false
    let micBlocked = false
    let camBlocked = false

    try {
      const cam = await Camera.requestCameraPermissionsAsync()
      cameraGranted = !!cam.granted
      camBlocked = !cam.granted && cam.canAskAgain === false
    } catch {
      cameraGranted = false
    }

    try {
      const mic = await Camera.requestMicrophonePermissionsAsync()
      microphoneGranted = !!mic.granted
      micBlocked = !mic.granted && mic.canAskAgain === false
    } catch {
      microphoneGranted = false
    }

    if (!cameraGranted) {
      denials.push({
        kind: 'camera',
        message: meetingPermissionDenialMessage('camera', { blockedInSettings: camBlocked }),
        blockedInSettings: camBlocked,
      })
    }

    if (!microphoneGranted) {
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
