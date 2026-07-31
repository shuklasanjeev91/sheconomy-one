import { AudioPresets, ScreenSharePresets, type RoomOptions } from 'livekit-client'

import { CALL_AUDIO_CAPTURE } from '~/co-work/lib/livekit-call-audio'

type LiveKitRoomPlatform = 'web' | 'native'

/**
 * Shared LiveKit room options for co-work meetings and chat calls.
 * Tuned for clear speech (AEC/NS/AGC), reliable web↔native video, and Bluetooth-friendly capture.
 *
 * Screen share: disable adaptiveStream on both platforms. Adaptive stream often
 * observes a 0×0 RTCView/video element on the first layout pass and requests no
 * layers — Android then logs "Dropping frame - No surface" / blank tiles on every
 * platform pair. Explicit subscribe boost handles quality instead.
 */
export function getLiveKitRoomOptions(platform: LiveKitRoomPlatform = 'web'): RoomOptions {
  const shared: RoomOptions = {
    // Dynacast can pause the only screen-share layer when no viewer has
    // reported dimensions yet — keep it off so Present always forwards.
    dynacast: false,
    adaptiveStream: false,
    audioCaptureDefaults: {
      ...CALL_AUDIO_CAPTURE,
      channelCount: 1,
      ...(platform === 'web' ? { voiceIsolation: true } : {}),
    },
    videoCaptureDefaults: {
      resolution: { width: 1280, height: 720, frameRate: 24 },
    },
    publishDefaults: {
      videoCodec: 'vp8',
      audioPreset: AudioPresets.speech,
      dtx: true,
      red: true,
      stopMicTrackOnMute: true,
      // Camera can still simulcast; screen share uses screenShareSimulcastLayers: [].
      simulcast: true,
      screenShareEncoding: ScreenSharePresets.h720fps15.encoding,
      screenShareSimulcastLayers: [],
      backupCodec: false,
    },
  }

  if (platform === 'native') {
    return {
      ...shared,
      // Dual PC path avoids black remote video regressions with livekit-client ≥ 2.19.2.
      singlePeerConnection: false,
    }
  }

  return {
    ...shared,
    // Web defaults are fine with a single peer connection.
  }
}
