import { useMemo } from 'react'
import { Track } from 'livekit-client'

import { useLocalParticipant, useTracks } from '@livekit/components-react'

import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'

/** Stage tiles (screen share focused) + optional local PiP tile — web. */
export function useMeetingGalleryTracks() {
  const { localParticipant } = useLocalParticipant()
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  return useMemo(
    () => composeMeetingStageTracks(tracks, localParticipant.identity),
    [tracks, localParticipant.identity],
  )
}
