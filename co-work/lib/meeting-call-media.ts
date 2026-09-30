import type { MeetingMediaMode } from '~/co-work/lib/meeting-media-controls'
import { shouldRestoreCameraAfterForeground } from '~/co-work/lib/meeting-lifecycle'
import type { MediasoupRoom } from '~/co-work/lib/mediasoup/mediasoup-room'

/**
 * After app goes to true OS background (native only): pause local camera so
 * audio can keep running under OS background rules. Web keeps the camera on
 * across tab switches / in-app minimize (Zoom-style).
 */
export async function pauseMeetingCameraForBackground(room: MediasoupRoom): Promise<void> {
  try {
    if (room.getSnapshot().local.cameraEnabled) {
      await room.setCameraEnabled(false)
    }
  } catch {
    // Soft-fail — connection stays up; banner explains OS limits.
  }
}

/**
 * After app/tab foreground: keep mic as the user left it, restore camera only
 * when the OS paused it while the user still intended it on.
 */
export async function restoreMeetingMediaAfterForeground(
  room: MediasoupRoom,
  mediaMode: MeetingMediaMode,
  options?: { intendedCameraOn?: boolean },
): Promise<{ cameraRestored: boolean }> {
  const local = room.getSnapshot().local
  const cameraTrackEnded = local.cameraEnabled && local.cameraRawTrack?.readyState === 'ended'
  try {
    if (cameraTrackEnded) {
      // The OS stopped capture while the producer stayed up — recapture.
      await room.setCameraEnabled(false)
    }
    if (
      shouldRestoreCameraAfterForeground({
        intendedCameraOn: !!options?.intendedCameraOn || cameraTrackEnded,
        cameraEnabled: room.getSnapshot().local.cameraEnabled,
        mediaAllowsCamera: mediaMode !== 'audio',
      })
    ) {
      await room.setCameraEnabled(true, { facingMode: local.cameraFacing })
      return { cameraRestored: room.getSnapshot().local.cameraEnabled }
    }
  } catch {
    // Leave connection intact; UI surfaces OS-paused camera status.
  }
  return { cameraRestored: false }
}
