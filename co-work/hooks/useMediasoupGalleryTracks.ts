import { useMemo, useRef } from 'react'

import { useMeetingLiveSignals } from '~/co-work/components/MeetingLiveSignalsContext'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'
import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import {
  withMediasoupRosterPlaceholders,
  type MediasoupTrackRef,
} from '~/co-work/lib/mediasoup/mediasoup-stage-tracks'

/**
 * Keep the last speaker focused through pauses (the SFU reports silence as
 * no speaker) until someone else talks or they leave.
 */
export function useStickyActiveSpeaker(
  activeSpeakerIdentity: string | null,
  presentIdentities: readonly string[],
): string | null {
  const lastRef = useRef<string | null>(null)
  if (activeSpeakerIdentity) lastRef.current = activeSpeakerIdentity
  else if (lastRef.current && !presentIdentities.includes(lastRef.current)) lastRef.current = null
  return activeSpeakerIdentity ?? lastRef.current
}

/** Stage tiles + filmstrip for gallery / speaker / screen-share — mediasoup. */
export function useMediasoupGalleryTracks(input: {
  trackRefs: MediasoupTrackRef[]
  localUserId: string
  activeSpeakerIdentity: string | null
  /** Own media is up; until then the peer list is incomplete and placeholders would flash. */
  mediaConnected: boolean
}) {
  const { state } = useMeetingMachine()
  const { spotlightUserId, pinnedUserIds, onlineRemoteParticipants } = useMeetingLiveSignals()
  const trackRefs = useMemo(
    () =>
      input.mediaConnected
        ? withMediasoupRosterPlaceholders(input.trackRefs, onlineRemoteParticipants)
        : input.trackRefs,
    [input.mediaConnected, input.trackRefs, onlineRemoteParticipants],
  )
  const identities = useMemo(() => trackRefs.map((track) => track.participant.identity), [trackRefs])
  const activeSpeakerIdentity = useStickyActiveSpeaker(input.activeSpeakerIdentity, identities)

  return useMemo(
    () =>
      composeMeetingStageTracks(trackRefs, input.localUserId, state.viewMode, activeSpeakerIdentity, {
        hideSelfView: state.hideSelfView,
        hideNonVideoParticipants: state.hideNonVideoParticipants,
        activeSpeakersOnly: state.activeSpeakersOnly,
        spotlightIdentity: spotlightUserId,
        pinnedIdentities: pinnedUserIds,
      }),
    [
      activeSpeakerIdentity,
      input.localUserId,
      trackRefs,
      pinnedUserIds,
      spotlightUserId,
      state.activeSpeakersOnly,
      state.hideNonVideoParticipants,
      state.hideSelfView,
      state.viewMode,
    ],
  )
}
