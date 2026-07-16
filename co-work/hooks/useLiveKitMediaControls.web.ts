import { useCallback, useState } from 'react'
import { useLocalParticipant, useRoomContext } from '@livekit/components-react'

import { CALL_AUDIO_CAPTURE } from '~/co-work/lib/livekit-call-audio'
import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'
import { setLocalScreenShareEnabled } from '~/co-work/lib/livekit-screen-share'

/** Native-only UI — exported so web never crashes if a shared import path is used. */
export function NativeScreenCapturePicker() {
  return null
}

export function useLiveKitMediaControls(preferSpeaker = true): LiveKitMediaControls {
  const room = useRoomContext()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant()
  const [speakerOn, setSpeakerOn] = useState(preferSpeaker)

  const toggleSpeaker = useCallback(async () => {
    // Web audio output follows the OS / browser device picker; keep UI state for controls.
    setSpeakerOn((prev) => !prev)
  }, [])

  return {
    room,
    localParticipant,
    audioEnabled: isMicrophoneEnabled,
    videoEnabled: isCameraEnabled,
    screenSharing: isScreenShareEnabled,
    speakerOn,
    toggleAudio: () => {
      const next = !isMicrophoneEnabled
      void localParticipant.setMicrophoneEnabled(next, { ...CALL_AUDIO_CAPTURE })
    },
    toggleVideo: () => void localParticipant.setCameraEnabled(!isCameraEnabled),
    toggleScreenShare: async () => {
      await setLocalScreenShareEnabled(localParticipant, !isScreenShareEnabled, 'web')
    },
    toggleSpeaker,
  }
}
