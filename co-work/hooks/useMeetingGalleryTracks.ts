import { useMemo } from 'react'
import { Track } from 'livekit-client'

import { useLocalParticipant, useRoomContext, useTracks } from '@livekit/components-react'

import { useMeetingActiveSpeaker } from '~/co-work/hooks/useMeetingActiveSpeaker'
import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import { useMeetingLiveSignals } from '~/co-work/components/MeetingLiveSignalsContext'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'

/** Stage tiles + filmstrip for gallery / speaker / screen-share — web. */
export function useMeetingGalleryTracks() {
  const { localParticipant } = useLocalParticipant()
  const room = useRoomContext()
  const { state } = useMeetingMachine()
  const { spotlightUserId, pinnedUserIds } = useMeetingLiveSignals()
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
    // Gallery uses speaking for highlight + ordering; speaker/share for focus tile.
    enabled: true,
  })

  return useMemo(
    () =>
      composeMeetingStageTracks(tracks, localParticipant.identity, state.viewMode, activeSpeakerIdentity, {
        hideSelfView: state.hideSelfView,
        hideNonVideoParticipants: state.hideNonVideoParticipants,
        activeSpeakersOnly: state.activeSpeakersOnly,
        spotlightIdentity: spotlightUserId,
        pinnedIdentities: pinnedUserIds,
      }),
    [
      activeSpeakerIdentity,
      localParticipant.identity,
      pinnedUserIds,
      spotlightUserId,
      state.activeSpeakersOnly,
      state.hideNonVideoParticipants,
      state.hideSelfView,
      state.viewMode,
      tracks,
    ],
  )
}
