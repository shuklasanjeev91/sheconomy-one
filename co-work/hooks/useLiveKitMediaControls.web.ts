import { useCallback, useRef, useState } from 'react'
import { useLocalParticipant, useRoomContext } from '@livekit/components-react'

import { CALL_AUDIO_CAPTURE } from '~/co-work/lib/livekit-call-audio'
import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'
import { setLocalScreenShareEnabled } from '~/co-work/lib/livekit-screen-share'
import { useMeetingVideoEffects } from '~/co-work/hooks/useMeetingVideoEffects.web'

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
  const muteInFlightRef = useRef(false)

  const toggleSpeaker = useCallback(async () => {
    // No-op: browser/OS controls the output device. Caller UI should treat
    // speaker as always-on / device-managed on web.
  }, [])

  const toggleAudio = useCallback(() => {
    if (muteInFlightRef.current) return
    const next = !isMicrophoneEnabled
    muteInFlightRef.current = true
    void localParticipant
      .setMicrophoneEnabled(next, { ...CALL_AUDIO_CAPTURE })
      .finally(() => {
        muteInFlightRef.current = false
      })
  }, [isMicrophoneEnabled, localParticipant])

  return {
    room,
    localParticipant,
    audioEnabled: isMicrophoneEnabled,
    videoEnabled: isCameraEnabled,
    screenSharing: isScreenShareEnabled,
    videoEffects,
    speakerOn,
    toggleAudio,
    toggleVideo: () => void localParticipant.setCameraEnabled(!isCameraEnabled),
    toggleScreenShare: async () => {
      await setLocalScreenShareEnabled(localParticipant, !isScreenShareEnabled, 'web')
    },
    toggleSpeaker,
  }
}
