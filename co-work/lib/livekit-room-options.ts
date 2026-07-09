import { AudioPresets, type RoomOptions } from 'livekit-client'

/** Voice-optimized LiveKit room options — speech preset, AEC, noise suppression. */
export function getLiveKitRoomOptions(): RoomOptions {
  return {
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      voiceIsolation: true,
    },
    videoCaptureDefaults: {
      resolution: { width: 1280, height: 720, frameRate: 24 },
    },
    publishDefaults: {
      audioPreset: AudioPresets.speech,
      dtx: true,
      red: true,
      stopMicTrackOnMute: true,
      simulcast: true,
    },
  }
}
