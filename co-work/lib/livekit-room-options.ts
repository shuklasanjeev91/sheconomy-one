import { AudioPresets, ScreenSharePresets, type RoomOptions } from 'livekit-client'

type LiveKitRoomPlatform = 'web' | 'native'

/**
 * Shared LiveKit room options for co-work meetings.
 * Tuned so screen share + camera works across web↔web, native↔native, and cross-platform.
 */
export function getLiveKitRoomOptions(platform: LiveKitRoomPlatform = 'web'): RoomOptions {
  const shared: RoomOptions = {
    dynacast: true,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      voiceIsolation: platform === 'web',
    },
    videoCaptureDefaults: {
      resolution: { width: 1280, height: 720, frameRate: 24 },
    },
    publishDefaults: {
      // VP8 is the most reliable cross-platform codec for web ↔ RN.
      videoCodec: 'vp8',
      audioPreset: AudioPresets.speech,
      dtx: true,
      red: true,
      stopMicTrackOnMute: true,
      simulcast: true,
      // Single high layer for screen share — avoids black tiles when a viewer
      // (especially web adaptiveStream) requests a low layer mobile never sent.
      screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
      screenShareSimulcastLayers: [],
    },
  }

  if (platform === 'native') {
    return {
      ...shared,
      // RN density-aware adaptive stream; dual PC path avoids black remote video
      // regressions with livekit-client ≥ 2.19.2 on React Native.
      adaptiveStream: { pixelDensity: 'screen' },
      singlePeerConnection: false,
    }
  }

  return {
    ...shared,
    adaptiveStream: true,
    // Keep default singlePeerConnection on web (more efficient; RN bug doesn't apply).
  }
}
