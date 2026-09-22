import { Platform } from 'react-native'
import { Track, type LocalParticipant, type LocalVideoTrack } from 'livekit-client'

export type CameraFacing = 'user' | 'environment'

type SwitchableTrack = MediaStreamTrack & {
  _switchCamera?: () => void
  applyConstraints?: (constraints: MediaTrackConstraints) => Promise<void>
  getSettings?: () => MediaTrackSettings
}

function oppositeFacing(current: CameraFacing): CameraFacing {
  return current === 'user' ? 'environment' : 'user'
}

function facingFromTrack(track: LocalVideoTrack | undefined, fallback: CameraFacing): CameraFacing {
  try {
    const settings = track?.mediaStreamTrack?.getSettings?.() as MediaTrackSettings | undefined
    if (settings?.facingMode === 'environment' || settings?.facingMode === 'user') {
      return settings.facingMode
    }
  } catch {
    // Ignore — some browsers/devices omit facingMode.
  }
  return fallback
}

/**
 * Flip local camera front ↔ rear.
 *
 * Native (iOS/Android WebRTC): prefer `_switchCamera()` which reuses the
 * capture session without tearing down the LiveKit publication.
 * Web / fallback: `restartTrack({ facingMode })` then `setCameraEnabled`.
 */
export async function flipLocalParticipantCamera(
  localParticipant: LocalParticipant,
  currentFacing: CameraFacing = 'user',
): Promise<CameraFacing> {
  const publication = localParticipant.getTrackPublication(Track.Source.Camera)
  const track = publication?.track as LocalVideoTrack | undefined
  const enabled = localParticipant.isCameraEnabled && !!track

  if (!enabled) {
    const nextFacing = oppositeFacing(currentFacing)
    await localParticipant.setCameraEnabled(true, { facingMode: nextFacing })
    return nextFacing
  }

  const resolvedFacing = facingFromTrack(track, currentFacing)
  const nextFacing = oppositeFacing(resolvedFacing)
  const mediaTrack = track?.mediaStreamTrack as SwitchableTrack | undefined

  // React Native WebRTC — switch facing without republishing.
  if (Platform.OS !== 'web' && mediaTrack && typeof mediaTrack._switchCamera === 'function') {
    mediaTrack._switchCamera()
    return nextFacing
  }

  // Web / generic: applyConstraints when available (keeps track id stable).
  if (mediaTrack && typeof mediaTrack.applyConstraints === 'function') {
    try {
      await mediaTrack.applyConstraints({ facingMode: nextFacing })
      return nextFacing
    } catch {
      // Fall through to LiveKit restart.
    }
  }

  if (track && typeof track.restartTrack === 'function') {
    await track.restartTrack({ facingMode: nextFacing })
    return nextFacing
  }

  await localParticipant.setCameraEnabled(false)
  await localParticipant.setCameraEnabled(true, { facingMode: nextFacing })
  return nextFacing
}
