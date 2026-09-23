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
 * Native Android/iOS: `applyConstraints({ facingMode })` with the known next
 * facing. Android requires the CameraCaptureController patch that honors
 * facingMode from the new constraints (stock RN WebRTC ignored it and kept
 * the constructor facing — toast said "Rear" while video stayed front).
 *
 * Never unpublish + republish on native — that freezes the local tile and
 * drops virtual-background processors mid-call.
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

  if (Platform.OS !== 'web' && mediaTrack && typeof mediaTrack.applyConstraints === 'function') {
    try {
      // Pass ideal + exact so normalizeConstraints keeps environment/user.
      await mediaTrack.applyConstraints({
        facingMode: { exact: nextFacing } as unknown as ConstrainDOMString,
      })
      const actual = facingFromTrack(track, nextFacing)
      if (actual === nextFacing) return nextFacing
      // Some devices ignore `exact` — retry with plain string.
      await mediaTrack.applyConstraints({ facingMode: nextFacing })
      return facingFromTrack(track, nextFacing)
    } catch {
      // Fall through.
    }
  }

  if (Platform.OS !== 'web' && mediaTrack && typeof mediaTrack._switchCamera === 'function') {
    mediaTrack._switchCamera()
    return facingFromTrack(track, nextFacing)
  }

  if (mediaTrack && typeof mediaTrack.applyConstraints === 'function') {
    try {
      await mediaTrack.applyConstraints({ facingMode: nextFacing })
      return facingFromTrack(track, nextFacing)
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
