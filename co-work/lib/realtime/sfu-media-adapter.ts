import type { MeetingMediaControls } from '~/co-work/lib/meeting-media-controls'
import type { MeetingMediaAdapter, MeetingMediaSnapshot } from '~/co-work/lib/realtime/meeting-session'

/**
 * SFU media controls → MeetingMediaAdapter.
 *
 * Accepts a getter so React control object identity changes do not require
 * re-registering the adapter on every render.
 */
export function createSfuMeetingMediaAdapter(
  getMedia: () => MeetingMediaControls | null,
): MeetingMediaAdapter {
  const requireMedia = (): MeetingMediaControls => {
    const media = getMedia()
    if (!media) {
      throw new Error('Meeting media is not connected yet.')
    }
    return media
  }

  return {
    // The room component owns the SFU connection; nothing to open here.
    connect: async () => {},
    disconnect: async () => {
      const media = getMedia()
      if (!media) return
      try {
        if (media.screenSharing) {
          await media.toggleScreenShare()
        }
      } catch {
        // Best-effort.
      }
      try {
        media.disconnect()
      } catch {
        // Already torn down.
      }
    },
    toggleMic: () => {
      requireMedia().toggleAudio()
    },
    toggleCamera: () => {
      requireMedia().toggleVideo()
    },
    startScreenShare: async () => {
      const media = requireMedia()
      if (media.screenSharing) return
      await media.toggleScreenShare()
    },
    stopScreenShare: async () => {
      const media = requireMedia()
      if (!media.screenSharing) return
      await media.toggleScreenShare()
    },
    changeAudioDevice: async (deviceId: string) => {
      await requireMedia().audioQuality.selectInputDevice(deviceId)
    },
    changeVideoDevice: async (deviceId: string) => {
      await requireMedia().audioQuality.selectVideoDevice(deviceId)
    },
    getMediaSnapshot: (): MeetingMediaSnapshot => {
      const media = getMedia()
      if (!media) {
        return {
          audioEnabled: false,
          videoEnabled: false,
          screenSharing: false,
          speakerOn: true,
        }
      }
      return {
        audioEnabled: media.audioEnabled,
        videoEnabled: media.videoEnabled,
        screenSharing: media.screenSharing,
        speakerOn: media.speakerOn,
      }
    },
  }
}
