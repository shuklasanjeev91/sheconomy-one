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

/** Stage tiles (remotes first) + optional local PiP tile. */
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
    const localTrack = displayTracks.find((track) => track.participant.identity === localIdentity)
    const remoteTracks = displayTracks.filter((track) => track.participant.identity !== localIdentity)

    const stageTracks = remoteTracks.length > 0 ? remoteTracks : localTrack ? [localTrack] : displayTracks
    const pipTrack = remoteTracks.length > 0 ? localTrack ?? null : null

    return { stageTracks, pipTrack, totalTiles: stageTracks.length + (pipTrack ? 1 : 0) }
  }, [displayTracks, localParticipant.identity])
}
