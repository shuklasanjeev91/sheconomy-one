import type { Room } from 'livekit-client'

import { CALL_AUDIO_CAPTURE } from '~/co-work/lib/livekit-call-audio'
import type { LiveKitMediaMode } from '~/co-work/lib/livekit-media-controls'
import { shouldRestoreCameraAfterForeground } from '~/co-work/lib/meeting-lifecycle'

/**
 * One-shot connect reinforcement for chat calls and co-work meetings.
 *
 * - Publishes mic with AEC/NS/AGC once on first connect.
 * - Never re-enables the mic after the user has muted.
 * - Keeps audio calls camera-off; prefers camera-on for video calls.
 */
export async function reinforceCallMediaOnConnect(
  room: Room,
  mediaMode: LiveKitMediaMode,
  options?: {
    /** True only for the first Connected event for this room instance. */
    forceMicEnable?: boolean
  },
): Promise<void> {
  const forceMic = options?.forceMicEnable ?? false
  const local = room.localParticipant

  try {
    if (mediaMode === 'audio') {
      if (local.isCameraEnabled) {
        await local.setCameraEnabled(false)
      }
    } else if (mediaMode === 'video' && !local.isCameraEnabled) {
      await local.setCameraEnabled(true)
    }

    // Only publish/republish when we must enable a muted mic on first join.
    // Re-calling setMicrophoneEnabled(true) while already live republishes the
    // track (stopMicTrackOnMute) and looks like auto mute/unmute on Android.
    if (forceMic && !local.isMicrophoneEnabled) {
      await local.setMicrophoneEnabled(true, { ...CALL_AUDIO_CAPTURE })
    }
  } catch {
    // Permission denial / missing device — leave the room connected.
  }
}

/**
 * After app goes to true OS background (native only): pause local camera so
 * audio can keep running under OS background rules. Web keeps the camera on
 * across tab switches / in-app minimize (Zoom-style).
 */
export async function pauseMeetingCameraForBackground(room: Room): Promise<void> {
  try {
    if (room.localParticipant.isCameraEnabled) {
      await room.localParticipant.setCameraEnabled(false)
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
  room: Room,
  mediaMode: LiveKitMediaMode,
  options?: {
    intendedCameraOn?: boolean
  },
): Promise<{ cameraRestored: boolean }> {
  const local = room.localParticipant
  let cameraRestored = false

  try {
    // Never republish an already-on mic on foreground — that causes mute flicker.
    // Mic stays as the user left it; only camera may need restore after OS pause.

    const mediaAllowsCamera = mediaMode !== 'audio'
    if (
      shouldRestoreCameraAfterForeground({
        intendedCameraOn: !!options?.intendedCameraOn,
        cameraEnabled: local.isCameraEnabled,
        mediaAllowsCamera,
      })
    ) {
      await local.setCameraEnabled(true)
      cameraRestored = local.isCameraEnabled
    }
  } catch {
    // Leave connection intact; UI surfaces OS-paused camera status.
  }

  return { cameraRestored }
}
