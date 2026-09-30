import { useCallback } from 'react'

import { MeetingVideoStageView } from '~/co-work/components/MeetingVideoStage'
import { MediasoupParticipantTile } from '~/co-work/components/MediasoupParticipantTile.web'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'
import { useMediasoupGalleryTracks } from '~/co-work/hooks/useMediasoupGalleryTracks'
import type { MediasoupMeeting } from '~/co-work/hooks/useMediasoupMeeting'
import { selfViewMirrorAllowed } from '~/co-work/lib/meeting-video-mirror'
import {
  MEETING_SUBSCRIBE_ALL_BELOW,
  type MeetingVideoQuality,
} from '~/co-work/lib/meeting-selective-subscribe'
import {
  mediasoupTrackKey,
  mediasoupVisibleUserIds,
  type MediasoupTrackRef,
} from '~/co-work/lib/mediasoup/mediasoup-stage-tracks'

/** Web meeting stage — layout, paging and floating self-view. */
export function MediasoupVideoStage({ meeting }: { meeting: MediasoupMeeting }) {
  const { state } = useMeetingMachine()
  const { room } = meeting
  const gallery = useMediasoupGalleryTracks({
    trackRefs: meeting.trackRefs,
    localUserId: meeting.localUserId,
    activeSpeakerIdentity: meeting.activeSpeakerIdentity,
  })
  const remotePeerCount = meeting.snapshot.peers.length

  const onVisibleIdentities = useCallback(
    (identities: Set<string>) => {
      room?.setVisibleUserIds(
        mediasoupVisibleUserIds(identities, remotePeerCount, MEETING_SUBSCRIBE_ALL_BELOW),
      )
    },
    [remotePeerCount, room],
  )

  const onPreferredLayer = useCallback(
    (userId: string, spatialLayer: number) => room?.setPreferredVideoLayer(userId, spatialLayer),
    [room],
  )

  const onScreenAttached = useCallback((userId: string) => room?.requestScreenKeyFrame(userId), [room])

  const selfViewMirror = selfViewMirrorAllowed(state.mirrorLocalVideo, state.localBackgroundMode)
  const renderTiles = useCallback(
    (tracks: MediasoupTrackRef[], cameraQuality: MeetingVideoQuality) =>
      tracks.map((track) => (
        <MediasoupParticipantTile
          key={mediasoupTrackKey(track)}
          trackRef={track}
          mirrorLocalVideo={selfViewMirror}
          cameraQuality={cameraQuality}
          onPreferredLayer={onPreferredLayer}
          onScreenAttached={onScreenAttached}
        />
      )),
    [onPreferredLayer, onScreenAttached, selfViewMirror],
  )

  const toggleScreenShare = meeting.media?.toggleScreenShare
  const onStopScreenShare = useCallback(() => {
    void Promise.resolve(toggleScreenShare?.()).catch(() => {})
  }, [toggleScreenShare])

  return (
    <MeetingVideoStageView
      gallery={gallery}
      renderTiles={renderTiles}
      onVisibleIdentities={onVisibleIdentities}
      onStopScreenShare={onStopScreenShare}
    />
  )
}
