import type { Room } from 'livekit-client'

import { CALL_AUDIO_CAPTURE } from '~/co-work/lib/livekit-call-audio'
import type { LiveKitMediaMode } from '~/co-work/lib/livekit-media-controls'

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

    if (forceMic || local.isMicrophoneEnabled) {
      // Republish with speech-processing constraints even if already enabled so
      // both sides get AEC/NS. When forceMic is false we only touch an already-on mic.
      await local.setMicrophoneEnabled(true, { ...CALL_AUDIO_CAPTURE })
    }
  } catch {
    // Permission denial / missing device — leave the room connected.
  }
}
