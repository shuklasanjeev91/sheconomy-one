import { useLocalParticipant, useRoomContext } from '@livekit/components-react'

import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'

export function useLiveKitMediaControls(): LiveKitMediaControls {
  const room = useRoomContext()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant()

  return {
    room,
    localParticipant,
    audioEnabled: isMicrophoneEnabled,
    videoEnabled: isCameraEnabled,
    screenSharing: isScreenShareEnabled,
    toggleAudio: () => {
      const next = !isMicrophoneEnabled
      void localParticipant.setMicrophoneEnabled(next, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        voiceIsolation: true,
      })
    },
    toggleVideo: () => void localParticipant.setCameraEnabled(!isCameraEnabled),
    toggleScreenShare: async () => {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
    },
  }
}
