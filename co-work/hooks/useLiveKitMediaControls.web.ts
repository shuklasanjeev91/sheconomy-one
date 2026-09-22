import { useCallback, useMemo, useRef, useState } from 'react'
import { useLocalParticipant, useRoomContext } from '@livekit/components-react'

import { resolveCallAudioCapture } from '~/co-work/lib/livekit-call-audio'
import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'
import { setLocalScreenShareEnabled } from '~/co-work/lib/livekit-screen-share'
import { flipLocalParticipantCamera } from '~/co-work/lib/livekit-flip-camera'
import { useMeetingVideoEffects } from '~/co-work/hooks/useMeetingVideoEffects.web'
import { useMeetingAudioQuality } from '~/co-work/hooks/useMeetingAudioQuality.web'
import {
  detectMeetingWebCapabilities,
  mapWebMediaPermissionError,
  mapWebScreenShareError,
  meetingWebUnsupportedMessage,
  queryWebMediaPermission,
  releaseWebMediaStream,
  requestWebMicrophoneStream,
  unlockWebAudioPlayback,
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
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user')
  const cameraFacingRef = useRef<'user' | 'environment'>('user')
  const videoEffects = useMeetingVideoEffects()
  const audioQuality = useMeetingAudioQuality(room, localParticipant, isMicrophoneEnabled)
  const muteInFlightRef = useRef(false)
  const cameraInFlightRef = useRef(false)
  const screenInFlightRef = useRef(false)
  const flipInFlightRef = useRef(false)

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
    void (async () => {
      try {
        if (next) {
          unlockWebAudioPlayback()
          await room.startAudio().catch(() => {})
          const permissionState = await queryWebMediaPermission('microphone')
          // Only probe getUserMedia when the browser still needs a permission
          // prompt. Stopping a granted stream then recapturing it is what made
          // Unmute fail with NotReadableError.
          if (permissionState !== 'granted') {
            const stream = await requestWebMicrophoneStream()
            await releaseWebMediaStream(stream)
          }
        }
        try {
          const capture = await resolveCallAudioCapture()
          await localParticipant.setMicrophoneEnabled(next, capture)
        } catch (advanced) {
          if (!next) throw advanced
          await localParticipant.setMicrophoneEnabled(true)
        }
      } catch (cause) {
        const state = await queryWebMediaPermission('microphone')
        audioQuality.reportError(new Error(mapWebMediaPermissionError('microphone', cause, state)))
      } finally {
        muteInFlightRef.current = false
      }
    })()
  }, [audioQuality, isMicrophoneEnabled, localParticipant, room])

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
      .setCameraEnabled(next, next ? { facingMode: cameraFacingRef.current } : undefined)
      .catch((cause) => {
        audioQuality.reportError(new Error(mapWebMediaPermissionError('camera', cause)))
      })
      .finally(() => {
        cameraInFlightRef.current = false
      })
  }, [audioQuality, isCameraEnabled, localParticipant])

  const flipCamera = useCallback(async () => {
    if (flipInFlightRef.current) return cameraFacingRef.current
    flipInFlightRef.current = true
    try {
      const nextFacing = await flipLocalParticipantCamera(
        localParticipant,
        cameraFacingRef.current,
      )
      cameraFacingRef.current = nextFacing
      setCameraFacing(nextFacing)
      return nextFacing
    } catch (cause) {
      audioQuality.reportError(new Error(mapWebMediaPermissionError('camera', cause)))
      throw cause instanceof Error ? cause : new Error(mapWebMediaPermissionError('camera', cause))
    } finally {
      flipInFlightRef.current = false
    }
  }, [audioQuality, localParticipant])

  const toggleScreenShare = useCallback(async (options?: import('~/co-work/lib/livekit-screen-share').ScreenShareStartOptions | null) => {
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
      await setLocalScreenShareEnabled(
        localParticipant,
        !isScreenShareEnabled,
        'web',
        isScreenShareEnabled ? null : options,
      )
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
      cameraFacing,
      toggleAudio,
      toggleVideo,
      toggleScreenShare,
      toggleSpeaker,
      flipCamera,
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
      cameraFacing,
      toggleAudio,
      toggleVideo,
      toggleScreenShare,
      toggleSpeaker,
      flipCamera,
    ],
  )
}
