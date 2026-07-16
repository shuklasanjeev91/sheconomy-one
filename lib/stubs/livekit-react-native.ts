export function registerGlobals() {}

export function LiveKitRoom({ children }: { children?: React.ReactNode }) {
  return children ?? null
}

export function VideoTrack() {
  return null
}

export function useTracks() {
  return []
}

export function useRoomContext() {
  return null
}

export function useLocalParticipant() {
  return {
    localParticipant: {
      setMicrophoneEnabled: async () => {},
      setCameraEnabled: async () => {},
      setScreenShareEnabled: async () => {},
    },
    isMicrophoneEnabled: false,
    isCameraEnabled: false,
    isScreenShareEnabled: false,
  }
}

export function isTrackReference() {
  return false
}

export const AndroidAudioTypePresets = {
  communication: {},
  media: {},
}

export const AudioSession = {
  configureAudio: async () => {},
  startAudioSession: async () => {},
  stopAudioSession: async () => {},
  setDefaultRemoteAudioTrackVolume: async () => {},
  getAudioOutputs: async () => [] as string[],
  selectAudioOutput: async () => {},
  showAudioRoutePicker: async () => {},
  setAppleAudioConfiguration: async () => {},
}

export function setupIOSAudioManagement() {
  return () => {}
}
