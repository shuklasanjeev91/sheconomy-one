import { useEffect } from 'react'
import { Track, VideoQuality, type RemoteTrackPublication } from 'livekit-client'

import {
  ParticipantTile,
  useEnsureTrackRef,
  type ParticipantTileProps,
} from '@livekit/components-react'

import {
  isScreenSharePublication,
  SCREEN_SHARE_SUBSCRIBE_DIMENSIONS,
} from '~/co-work/lib/livekit-screen-share'

/** Branded LiveKit participant tile — styled via sheconomy-participant-tile CSS. */
export function SheconomyParticipantTile(props: ParticipantTileProps) {
  return (
    <>
      <ScreenShareQualityBooster />
      <ParticipantTile className="sheconomy-participant-tile" {...props} />
    </>
  )
}

/**
 * Force full-quality subscription for remote screen shares so web viewers
 * receive the only layer mobile publishers send (no low simulcast).
 */
function ScreenShareQualityBooster() {
  const trackRef = useEnsureTrackRef()

  useEffect(() => {
    const publication = trackRef.publication
    if (!publication) return
    if (trackRef.participant.isLocal) return
    if (
      trackRef.source !== Track.Source.ScreenShare &&
      !isScreenSharePublication(publication)
    ) {
      return
    }

    const remote = publication as RemoteTrackPublication
    if (!remote.isSubscribed) remote.setSubscribed(true)
    remote.setEnabled(true)
    remote.setVideoDimensions(SCREEN_SHARE_SUBSCRIBE_DIMENSIONS)
    remote.setVideoQuality(VideoQuality.HIGH)
  }, [
    trackRef.participant.identity,
    trackRef.participant.isLocal,
    trackRef.publication,
    trackRef.source,
  ])

  return null
}
