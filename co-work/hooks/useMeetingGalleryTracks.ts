import { useMemo } from 'react'
import { Track } from 'livekit-client'

import { isTrackReference, type TrackReferenceOrPlaceholder } from '@livekit/components-core'
import { useLocalParticipant, useTracks } from '@livekit/components-react'

function oneCameraTilePerParticipant(tracks: TrackReferenceOrPlaceholder[]) {
  const screenShares: TrackReferenceOrPlaceholder[] = []
  const cameraByIdentity = new Map<string, TrackReferenceOrPlaceholder>()

  for (const track of tracks) {
    if (isTrackReference(track) && track.publication.source === Track.Source.ScreenShare) {
      screenShares.push(track)
      continue
    }

    if (track.source !== Track.Source.Camera) continue

    const identity = track.participant.identity
    const existing = cameraByIdentity.get(identity)
    if (!existing) {
      cameraByIdentity.set(identity, track)
      continue
    }

    // Prefer subscribed camera track over placeholder.
    if (!isTrackReference(existing) && isTrackReference(track)) {
      cameraByIdentity.set(identity, track)
    }
  }

  return [...screenShares, ...cameraByIdentity.values()]
}

/**
 * Meet / Zoom / WhatsApp-style track roles:
 * - 1:1 call → remote fills stage, local floats as PiP
 * - 3+ people → everyone (including local) in the equal gallery
 * - Screen shares always lead the stage
 */
export function useMeetingGalleryTracks() {
  const { localParticipant } = useLocalParticipant()
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  const displayTracks = useMemo(() => oneCameraTilePerParticipant(tracks), [tracks])

  return useMemo(() => {
    const localIdentity = localParticipant.identity
    const screenShares = displayTracks.filter(
      (track) => isTrackReference(track) && track.publication.source === Track.Source.ScreenShare,
    )
    const cameras = displayTracks.filter(
      (track) => !isTrackReference(track) || track.publication.source !== Track.Source.ScreenShare,
    )
    const localCamera = cameras.find((track) => track.participant.identity === localIdentity) ?? null
    const remoteCameras = cameras.filter((track) => track.participant.identity !== localIdentity)

    // WhatsApp / Meet 1:1 — remote fills the stage, self is PiP.
    const isDualCall = screenShares.length === 0 && remoteCameras.length === 1 && !!localCamera

    if (isDualCall) {
      return {
        stageTracks: remoteCameras,
        pipTrack: localCamera,
        totalTiles: 2,
        isDualCall: true,
      }
    }

    // Gallery: everyone equal (Meet/Zoom tiled). Screens first if present.
    const stageTracks = [...screenShares, ...cameras]
    return {
      stageTracks,
      pipTrack: null as TrackReferenceOrPlaceholder | null,
      totalTiles: stageTracks.length,
      isDualCall: false,
    }
  }, [displayTracks, localParticipant.identity])
}
