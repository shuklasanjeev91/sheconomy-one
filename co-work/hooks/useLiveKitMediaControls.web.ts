import { useCallback, useMemo, useRef, useState } from 'react'
import { useLocalParticipant, useRoomContext } from '@livekit/components-react'

import { CALL_AUDIO_CAPTURE } from '~/co-work/lib/livekit-call-audio'
import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'
import { setLocalScreenShareEnabled } from '~/co-work/lib/livekit-screen-share'
import { useMeetingVideoEffects } from '~/co-work/hooks/useMeetingVideoEffects.web'
import { useMeetingAudioQuality } from '~/co-work/hooks/useMeetingAudioQuality.web'
import {
  detectMeetingWebCapabilities,
  mapWebMediaPermissionError,
  mapWebScreenShareError,
  meetingWebUnsupportedMessage,
} from '~/co-work/lib/meeting-web'

/** Native-only UI — exported so web never crashes if a shared import path is used. */
export function NativeScreenCapturePicker() {
  return null
}

export function useLiveKitMediaControls(_preferSpeaker = true): LiveKitMediaControls {
  const room = useRoomContext()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant()
  // Web output follows the OS / browser device picker — there is no portable
  // earpiece route. Keep speakerOn true so UI does not fake a Phone mode.
  const [speakerOn] = useState(true)
  const videoEffects = useMeetingVideoEffects()
  const audioQuality = useMeetingAudioQuality(room, localParticipant, isMicrophoneEnabled)
  const muteInFlightRef = useRef(false)
  const cameraInFlightRef = useRef(false)
  const screenInFlightRef = useRef(false)

  const toggleSpeaker = useCallback(async () => {
    // No-op: browser/OS controls the output device. Caller UI should treat
    // speaker as always-on / device-managed on web.
  }, [])

  const toggleAudio = useCallback(() => {
    if (muteInFlightRef.current) return
    const caps = detectMeetingWebCapabilities()
    if (!caps.secureContext || !caps.getUserMedia) {
      audioQuality.reportError(
        new Error(
          !caps.secureContext
            ? meetingWebUnsupportedMessage('secure_context')
            : meetingWebUnsupportedMessage('microphone'),
        ),
      )
      return
    }
    const next = !isMicrophoneEnabled
    muteInFlightRef.current = true
    void localParticipant
      .setMicrophoneEnabled(next, { ...CALL_AUDIO_CAPTURE })
      .catch((cause) => {
        audioQuality.reportError(new Error(mapWebMediaPermissionError('microphone', cause)))
      })
      .finally(() => {
        muteInFlightRef.current = false
      })
  }, [audioQuality, isMicrophoneEnabled, localParticipant])

  const toggleVideo = useCallback(() => {
    if (cameraInFlightRef.current) return
    const caps = detectMeetingWebCapabilities()
    if (!caps.secureContext || !caps.getUserMedia) {
      audioQuality.reportError(
        new Error(
          !caps.secureContext
            ? meetingWebUnsupportedMessage('secure_context')
            : meetingWebUnsupportedMessage('camera'),
        ),
      )
      return
    }
    const next = !isCameraEnabled
    cameraInFlightRef.current = true
    void localParticipant
      .setCameraEnabled(next)
      .catch((cause) => {
        audioQuality.reportError(new Error(mapWebMediaPermissionError('camera', cause)))
      })
      .finally(() => {
        cameraInFlightRef.current = false
      })
  }, [audioQuality, isCameraEnabled, localParticipant])

  const toggleScreenShare = useCallback(async () => {
    if (screenInFlightRef.current) return
    const caps = detectMeetingWebCapabilities()
    if (!isScreenShareEnabled) {
      if (!caps.secureContext) {
        throw new Error(meetingWebUnsupportedMessage('secure_context'))
      }
      if (!caps.getDisplayMedia) {
        throw new Error(meetingWebUnsupportedMessage('screen_share'))
      }
    }
    screenInFlightRef.current = true
    try {
      await setLocalScreenShareEnabled(localParticipant, !isScreenShareEnabled, 'web')
    } catch (cause) {
      throw new Error(mapWebScreenShareError(cause))
    } finally {
      screenInFlightRef.current = false
    }
  }, [isScreenShareEnabled, localParticipant])

  return useMemo(
    () => ({
      room,
      localParticipant,
      audioEnabled: isMicrophoneEnabled,
      videoEnabled: isCameraEnabled,
      screenSharing: isScreenShareEnabled,
      videoEffects,
      audioQuality,
      speakerOn,
      toggleAudio,
      toggleVideo,
      toggleScreenShare,
      toggleSpeaker,
    }),
    [
      room,
      localParticipant,
      isMicrophoneEnabled,
      isCameraEnabled,
      isScreenShareEnabled,
      videoEffects,
      audioQuality,
      speakerOn,
      toggleAudio,
      toggleVideo,
      toggleScreenShare,
      toggleSpeaker,
    ],
  )
}
