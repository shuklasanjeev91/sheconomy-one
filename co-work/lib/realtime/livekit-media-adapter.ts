import { ConnectionState } from 'livekit-client'

import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'
import { setLocalScreenShareEnabled } from '~/co-work/lib/livekit-screen-share'
import type { MeetingMediaAdapter, MeetingMediaSnapshot } from '~/co-work/lib/realtime/meeting-session'

/**
 * LiveKit SFU → MeetingMediaAdapter.
 * The only production media backend for Co-Work meetings.
 *
 * Accepts a getter so React control object identity changes do not require
 * re-registering the adapter on every render.
 */
export function createLiveKitMeetingMediaAdapter(
  getLiveKit: () => LiveKitMediaControls | null,
  options?: { platform?: 'web' | 'native' },
): MeetingMediaAdapter {
  const platform = options?.platform ?? 'web'

  const requireLiveKit = (): LiveKitMediaControls => {
    const liveKit = getLiveKit()
    if (!liveKit) {
      throw new Error('Meeting media (LiveKit SFU) is not connected yet.')
    }
    return liveKit
  }

  return {
    connect: async () => {
      const liveKit = getLiveKit()
      if (!liveKit) return
      // <LiveKitRoom /> owns the websocket connect; this is a readiness check.
      if (liveKit.room.state !== ConnectionState.Connected) return
    },
    disconnect: async () => {
      const liveKit = getLiveKit()
      if (!liveKit) return
      try {
        if (liveKit.screenSharing) {
          await setLocalScreenShareEnabled(liveKit.localParticipant, false, platform)
        }
      } catch {
        // Best-effort.
      }
      try {
        liveKit.room.disconnect(true)
      } catch {
        // Already torn down.
      }
    },
    toggleMic: () => {
      requireLiveKit().toggleAudio()
    },
    toggleCamera: () => {
      requireLiveKit().toggleVideo()
    },
    startScreenShare: async () => {
      const liveKit = requireLiveKit()
      if (liveKit.screenSharing) return
      await liveKit.toggleScreenShare()
    },
    stopScreenShare: async () => {
      const liveKit = requireLiveKit()
      if (!liveKit.screenSharing) return
      await liveKit.toggleScreenShare()
    },
    changeAudioDevice: async (deviceId: string) => {
      await requireLiveKit().audioQuality.selectInputDevice(deviceId)
    },
    changeVideoDevice: async (deviceId: string) => {
      await requireLiveKit().audioQuality.selectVideoDevice(deviceId)
    },
    getMediaSnapshot: (): MeetingMediaSnapshot => {
      const liveKit = getLiveKit()
      if (!liveKit) {
        return {
          audioEnabled: false,
          videoEnabled: false,
          screenSharing: false,
          speakerOn: true,
        }
      }
      return {
        audioEnabled: liveKit.audioEnabled,
        videoEnabled: liveKit.videoEnabled,
        screenSharing: liveKit.screenSharing,
        speakerOn: liveKit.speakerOn,
      }
    },
  }
}
