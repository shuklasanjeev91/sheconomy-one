import { useMemo } from 'react'
import { Track } from 'livekit-client'

import { useLocalParticipant, useRoomContext, useTracks } from '@livekit/components-react'

import { useMeetingActiveSpeaker } from '~/co-work/hooks/useMeetingActiveSpeaker'
import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'

/** Stage tiles + filmstrip for gallery / speaker / screen-share — web. */
export function useMeetingGalleryTracks() {
  const { localParticipant } = useLocalParticipant()
  const room = useRoomContext()
  const { state } = useMeetingMachine()
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  const activeSpeakerIdentity = useMeetingActiveSpeaker({
    room,
    tracks,
    enabled: state.viewMode === 'speaker' || state.viewMode === 'screen-share',
  })

  return useMemo(
    () =>
      composeMeetingStageTracks(
        tracks,
        localParticipant.identity,
        state.viewMode,
        activeSpeakerIdentity,
        state.hideSelfView,
      ),
    [activeSpeakerIdentity, localParticipant.identity, state.hideSelfView, state.viewMode, tracks],
  )
}
