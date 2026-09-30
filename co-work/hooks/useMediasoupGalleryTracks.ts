import { useMemo, useRef } from 'react'

import { useMeetingLiveSignals } from '~/co-work/components/MeetingLiveSignalsContext'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'
import { composeMeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import type { MediasoupTrackRef } from '~/co-work/lib/mediasoup/mediasoup-stage-tracks'

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
}) {
  const { state } = useMeetingMachine()
  const { spotlightUserId, pinnedUserIds } = useMeetingLiveSignals()
  const identities = useMemo(
    () => input.trackRefs.map((track) => track.participant.identity),
    [input.trackRefs],
  )
  const activeSpeakerIdentity = useStickyActiveSpeaker(input.activeSpeakerIdentity, identities)

  return useMemo(
    () =>
      composeMeetingStageTracks(input.trackRefs, input.localUserId, state.viewMode, activeSpeakerIdentity, {
        hideSelfView: state.hideSelfView,
        hideNonVideoParticipants: state.hideNonVideoParticipants,
        activeSpeakersOnly: state.activeSpeakersOnly,
        spotlightIdentity: spotlightUserId,
        pinnedIdentities: pinnedUserIds,
      }),
    [
      activeSpeakerIdentity,
      input.localUserId,
      input.trackRefs,
      pinnedUserIds,
      spotlightUserId,
      state.activeSpeakersOnly,
      state.hideNonVideoParticipants,
      state.hideSelfView,
      state.viewMode,
    ],
  )
}
