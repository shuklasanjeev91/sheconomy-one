import { Track } from 'livekit-client'

import { isTrackReference, type TrackReferenceOrPlaceholder } from '@livekit/components-core'

import { isScreenSharePublication, isScreenShareSource } from '~/co-work/lib/livekit-screen-share'

export type MeetingStageTracks = {
  stageTracks: TrackReferenceOrPlaceholder[]
  pipTrack: TrackReferenceOrPlaceholder | null
  totalTiles: number
  hasScreenShare: boolean
}

function isScreenShareTrack(track: TrackReferenceOrPlaceholder) {
  if (isScreenShareSource(track.source)) return true
  return isTrackReference(track) && isScreenSharePublication(track.publication)
}

/**
 * Normalize camera + screen-share tracks into a focused stage layout that works
 * the same on web and native for every meeting direction.
 */
export function composeMeetingStageTracks(
  tracks: TrackReferenceOrPlaceholder[],
  localIdentity: string,
): MeetingStageTracks {
  const screenShares: TrackReferenceOrPlaceholder[] = []
  const cameraByIdentity = new Map<string, TrackReferenceOrPlaceholder>()

  for (const track of tracks) {
    if (isScreenShareTrack(track)) {
      if (isTrackReference(track)) screenShares.push(track)
      continue
    }

    if (track.source !== Track.Source.Camera) continue

    const identity = track.participant.identity
    const existing = cameraByIdentity.get(identity)
    if (!existing) {
      cameraByIdentity.set(identity, track)
      continue
    }

    if (!isTrackReference(existing) && isTrackReference(track)) {
      cameraByIdentity.set(identity, track)
    }
  }

  const cameras = [...cameraByIdentity.values()]
  const remoteScreens = screenShares.filter((track) => track.participant.identity !== localIdentity)
  const localScreens = screenShares.filter((track) => track.participant.identity === localIdentity)
  // Prefer remote presenter's screen; fall back to local self-preview while sharing.
  const focusedScreen = remoteScreens[0] ?? localScreens[0] ?? null

  const localCamera =
    cameras.find((track) => track.participant.identity === localIdentity) ?? null
  const remoteCameras = cameras.filter((track) => track.participant.identity !== localIdentity)

  if (focusedScreen) {
    const otherScreens = [...remoteScreens, ...localScreens].filter(
      (track) => track !== focusedScreen,
    )
    const stageTracks = [focusedScreen, ...otherScreens]
    // Show self camera in PiP while watching a remote screen; otherwise first remote.
    const pipTrack =
      focusedScreen.participant.identity === localIdentity
        ? remoteCameras[0] ?? null
        : localCamera ?? remoteCameras[0] ?? null

    return {
      stageTracks,
      pipTrack,
      totalTiles: stageTracks.length + (pipTrack ? 1 : 0),
      hasScreenShare: true,
    }
  }

  const stageTracks =
    remoteCameras.length > 0 ? remoteCameras : localCamera ? [localCamera] : cameras
  const pipTrack = remoteCameras.length > 0 ? localCamera : null

  return {
    stageTracks,
    pipTrack,
    totalTiles: stageTracks.length + (pipTrack ? 1 : 0),
    hasScreenShare: false,
  }
}
