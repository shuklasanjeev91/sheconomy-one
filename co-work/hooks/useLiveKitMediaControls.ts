import { Platform } from 'react-native'

import type { LiveKitMediaControls } from '~/co-work/components/LiveKitMeetingRoom'

function getLiveKitHooks() {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@livekit/components-react') as typeof import('@livekit/components-react')
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@livekit/react-native') as typeof import('@livekit/react-native')
}

export function useLiveKitMediaControls(): LiveKitMediaControls {
  const { useRoomContext, useLocalParticipant } = getLiveKitHooks()
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
        ...(Platform.OS === 'web' ? { voiceIsolation: true } : {}),
      })
    },
    toggleVideo: () => void localParticipant.setCameraEnabled(!isCameraEnabled),
    toggleScreenShare: () => void localParticipant.setScreenShareEnabled(!isScreenShareEnabled),
  }
}
