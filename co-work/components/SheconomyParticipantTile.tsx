import { useEffect, useMemo } from 'react'
import { Track, VideoQuality, type RemoteTrackPublication } from 'livekit-client'

import {
  ConnectionQualityIndicator,
  ParticipantName,
  ParticipantTile,
  TrackMutedIndicator,
  useEnsureTrackRef,
  VideoTrack,
  type ParticipantTileProps,
} from '@livekit/components-react'
import { isTrackReference } from '@livekit/components-core'

import { Avatar } from '~/components/ui'
import {
  getParticipantAvatarUrl,
  isCameraTileOff,
  participantDisplayName,
} from '~/co-work/lib/participant-avatar'
import {
  useParticipantHandRaised,
  useParticipantMeetingRole,
} from '~/co-work/components/MeetingLiveSignalsContext'
import { MeetingRoleBadge } from '~/co-work/components/MeetingRoleBadge'
import {
  isScreenSharePublication,
  SCREEN_SHARE_SUBSCRIBE_DIMENSIONS,
} from '~/co-work/lib/livekit-screen-share'
import {
  meetingVideoMirrorTransform,
  shouldMirrorMeetingVideo,
} from '~/co-work/lib/meeting-video-mirror'

type SheconomyParticipantTileProps = ParticipantTileProps & {
  mirrorLocalVideo?: boolean
}

/** Branded LiveKit participant tile — profile avatar when camera is off. */
export function SheconomyParticipantTile({
  mirrorLocalVideo = true,
  ...props
}: SheconomyParticipantTileProps) {
  return (
    <ParticipantTile className="sheconomy-participant-tile" {...props}>
      <ScreenShareQualityBooster />
      <SheconomyParticipantTileBody mirrorLocalVideo={mirrorLocalVideo} />
    </ParticipantTile>
  )
}

function SheconomyParticipantTileBody({ mirrorLocalVideo }: { mirrorLocalVideo: boolean }) {
  const trackRef = useEnsureTrackRef()
  const name = participantDisplayName(trackRef.participant)
  const avatarUrl = getParticipantAvatarUrl(trackRef.participant)
  const handRaised = useParticipantHandRaised(trackRef.participant.identity)
  const meetingRole = useParticipantMeetingRole(trackRef.participant.identity)
  const isScreen =
    trackRef.source === Track.Source.ScreenShare ||
    (isTrackReference(trackRef) && isScreenSharePublication(trackRef.publication))
  const isSpeaking = !isScreen && !!trackRef.participant.isSpeaking
  const micMuted = !isScreen && trackRef.participant.isMicrophoneEnabled === false

  const hasLiveVideo =
    isTrackReference(trackRef) &&
    !!trackRef.publication?.track &&
    !trackRef.publication.isMuted &&
    (trackRef.publication.kind === 'video' ||
      trackRef.source === Track.Source.Camera ||
      trackRef.source === Track.Source.ScreenShare)

  const cameraOff = useMemo(
    () =>
      !isScreen &&
      isCameraTileOff({
        source: trackRef.source,
        publication: isTrackReference(trackRef) ? trackRef.publication : null,
        isPlaceholder: !isTrackReference(trackRef),
      }),
    [isScreen, trackRef],
  )

  // Web LiveKit VideoTrack has no mirror prop — apply CSS scaleX for self-view only.
  const mirrored = shouldMirrorMeetingVideo({
    mirrorLocalVideo,
    isLocal: trackRef.participant.isLocal,
    isScreenShare: isScreen,
    source: trackRef.source,
  })

  return (
    <>
      {hasLiveVideo ? (
        <VideoTrack
          trackRef={trackRef}
          manageSubscription={false}
          className={mirrored ? 'sheconomy-video--mirrored' : undefined}
          style={{
            width: '100%',
            height: '100%',
            objectFit: isScreen ? 'contain' : 'cover',
            background: '#0c080a',
            transform: meetingVideoMirrorTransform(mirrored),
          }}
        />
      ) : null}

      {/* Screen share: never show profile avatar — that looked like a broken "image" tile
          when native→web frames were missing. Camera tiles keep the avatar fallback. */}
      {isScreen ? (
        !hasLiveVideo ? (
          <div className="lk-participant-placeholder sheconomy-screen-waiting" data-camera-off="false">
            <span className="sheconomy-participant-avatar-label">Receiving screen…</span>
          </div>
        ) : null
      ) : (
        <div className="lk-participant-placeholder" data-camera-off={cameraOff ? 'true' : 'false'}>
          <div className="sheconomy-participant-avatar-wrap">
            <Avatar name={name} src={avatarUrl ?? undefined} size="$8" />
            <span className="sheconomy-participant-avatar-label">
              {cameraOff ? name : 'Camera off'}
            </span>
          </div>
        </div>
      )}

      {handRaised && !isScreen ? (
        <div className="sheconomy-hand-raised" aria-label="Hand raised">
          ✋
        </div>
      ) : null}

      {!isScreen && (meetingRole === 'host' || meetingRole === 'co_host') ? (
        <div className="sheconomy-tile-role">
          <MeetingRoleBadge role={meetingRole} size="sm" />
        </div>
      ) : null}

      {isSpeaking ? <div className="sheconomy-speaking-indicator" aria-hidden /> : null}

      <div className="lk-participant-metadata">
        <div className="lk-participant-metadata-item">
          {trackRef.source === Track.Source.Camera ? (
            <>
              <TrackMutedIndicator
                trackRef={{
                  participant: trackRef.participant,
                  source: Track.Source.Microphone,
                }}
                show="muted"
              />
              {micMuted ? (
                <span className="sheconomy-mic-muted" aria-label="Muted">
                  🔇
                </span>
              ) : null}
              <ParticipantName />
              {handRaised ? <span className="sheconomy-hand-raised-inline">✋</span> : null}
            </>
          ) : (
            <ParticipantName>&apos;s screen</ParticipantName>
          )}
        </div>
        <ConnectionQualityIndicator className="lk-participant-metadata-item sheconomy-connection-quality" />
      </div>
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
    const boost = () => {
      if (!remote.isSubscribed) remote.setSubscribed(true)
      remote.setEnabled(true)
      remote.setVideoDimensions(SCREEN_SHARE_SUBSCRIBE_DIMENSIONS)
      remote.setVideoQuality(VideoQuality.HIGH)
    }
    boost()
    const id = window.setInterval(boost, 1500)
    const stop = window.setTimeout(() => window.clearInterval(id), 12_000)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(stop)
    }
  }, [
    trackRef.participant.identity,
    trackRef.participant.isLocal,
    trackRef.publication,
    trackRef.source,
  ])

  return null
}
