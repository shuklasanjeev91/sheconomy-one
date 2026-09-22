import { useEffect, useMemo, useState } from 'react'
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
  useMeetingLiveSignals,
  useParticipantHandRaised,
  useParticipantMeetingRole,
  useParticipantNonverbal,
} from '~/co-work/components/MeetingLiveSignalsContext'
import { MeetingRoleBadge } from '~/co-work/components/MeetingRoleBadge'
import { MeetingScreenShareVideo } from '~/co-work/components/MeetingScreenShareVideo'
import {
  isScreenSharePublication,
  SCREEN_SHARE_SUBSCRIBE_DIMENSIONS,
} from '~/co-work/lib/livekit-screen-share'
import { meetingNonverbalEmoji } from '~/co-work/lib/meeting-nonverbal'
import {
  meetingTileActionLabel,
  meetingTileMenuActions,
} from '~/co-work/lib/meeting-tile-actions'
import {
  meetingVideoMirrorTransform,
  shouldMirrorMeetingVideo,
} from '~/co-work/lib/meeting-video-mirror'

type SheconomyParticipantTileProps = ParticipantTileProps & {
  mirrorLocalVideo?: boolean
  hdVideo?: boolean
}

/** Branded LiveKit participant tile — profile avatar when camera is off. */
export function SheconomyParticipantTile({
  mirrorLocalVideo = true,
  hdVideo = true,
  ...props
}: SheconomyParticipantTileProps) {
  return (
    <ParticipantTile className="sheconomy-participant-tile" {...props}>
      <ScreenShareQualityBooster />
      <CameraHdQualityBooster enabled={hdVideo} />
      <SheconomyParticipantTileBody mirrorLocalVideo={mirrorLocalVideo} />
    </ParticipantTile>
  )
}

function SheconomyParticipantTileBody({ mirrorLocalVideo }: { mirrorLocalVideo: boolean }) {
  const trackRef = useEnsureTrackRef()
  const name = participantDisplayName(trackRef.participant)
  const avatarUrl = getParticipantAvatarUrl(trackRef.participant)
  const handRaised = useParticipantHandRaised(trackRef.participant.identity)
  const nonverbal = useParticipantNonverbal(trackRef.participant.identity)
  const meetingRole = useParticipantMeetingRole(trackRef.participant.identity)
  const {
    stopIncomingVideo,
    localUserId,
    spotlightUserId,
    pinnedUserIds,
    togglePinnedUserId,
    tileHostActions,
  } = useMeetingLiveSignals()
  const [menuOpen, setMenuOpen] = useState(false)
  const identity = trackRef.participant.identity
  const isSelf = identity === localUserId
  const isPinned = pinnedUserIds.includes(identity)
  const isSpotlighted = spotlightUserId === identity
  const isScreen =
    trackRef.source === Track.Source.ScreenShare ||
    (isTrackReference(trackRef) && isScreenSharePublication(trackRef.publication))
  const stopRemoteCamera =
    stopIncomingVideo && !trackRef.participant.isLocal && !isScreen && trackRef.source === Track.Source.Camera
  const isSpeaking = !isScreen && !!trackRef.participant.isSpeaking
  const micMuted = !isScreen && trackRef.participant.isMicrophoneEnabled === false

  const menuActions = useMemo(
    () =>
      meetingTileMenuActions({
        isSelf,
        isScreen,
        canModerate: !!tileHostActions?.canModerate,
        isPinned,
        isSpotlighted,
        handRaised,
      }),
    [handRaised, isPinned, isScreen, isSelf, isSpotlighted, tileHostActions?.canModerate],
  )

  const hasLiveVideo =
    !stopRemoteCamera &&
    isTrackReference(trackRef) &&
    !!trackRef.publication?.track &&
    !trackRef.publication.isMuted &&
    (trackRef.publication.kind === 'video' ||
      trackRef.source === Track.Source.Camera ||
      trackRef.source === Track.Source.ScreenShare)

  const cameraOff = useMemo(
    () =>
      stopRemoteCamera ||
      (!isScreen &&
        isCameraTileOff({
          source: trackRef.source,
          publication: isTrackReference(trackRef) ? trackRef.publication : null,
          isPlaceholder: !isTrackReference(trackRef),
        })),
    [isScreen, stopRemoteCamera, trackRef],
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
        isScreen ? (
          <MeetingScreenShareVideo trackRef={trackRef} />
        ) : (
          <VideoTrack
            trackRef={trackRef}
            manageSubscription={false}
            className={mirrored ? 'sheconomy-video--mirrored' : undefined}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              background: '#0c080a',
              transform: meetingVideoMirrorTransform(mirrored),
            }}
          />
        )
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
              {stopRemoteCamera ? 'Video paused' : cameraOff ? 'Camera off' : name}
            </span>
          </div>
        </div>
      )}

      {!isScreen && (isPinned || isSpotlighted) ? (
        <div className="sheconomy-tile-focus-badges" aria-hidden>
          {isSpotlighted ? (
            <span className="sheconomy-tile-badge sheconomy-tile-badge--spotlight">★</span>
          ) : null}
          {isPinned ? <span className="sheconomy-tile-badge sheconomy-tile-badge--pin">📌</span> : null}
        </div>
      ) : null}

      {handRaised && !isScreen ? (
        <div className="sheconomy-hand-raised" aria-label="Hand raised">
          ✋
        </div>
      ) : null}

      {nonverbal && !isScreen ? (
        <div className="sheconomy-nonverbal" aria-label={nonverbal}>
          {meetingNonverbalEmoji(nonverbal)}
        </div>
      ) : null}

      {!isScreen && (meetingRole === 'host' || meetingRole === 'co_host') ? (
        <div className="sheconomy-tile-role">
          <MeetingRoleBadge role={meetingRole} size="sm" />
        </div>
      ) : null}

      {menuActions.length > 0 ? (
        <div className="sheconomy-tile-menu" data-open={menuOpen ? 'true' : 'false'}>
          <button
            type="button"
            className="sheconomy-tile-menu-trigger"
            aria-label={`More actions for ${name}`}
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation()
              setMenuOpen((open) => !open)
            }}
          >
            ⋯
          </button>
          {menuOpen ? (
            <div className="sheconomy-tile-menu-popover" role="menu">
              {menuActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  className="sheconomy-tile-menu-item"
                  onClick={(event) => {
                    event.stopPropagation()
                    setMenuOpen(false)
                    if (action === 'pin' || action === 'unpin') {
                      togglePinnedUserId(identity)
                      return
                    }
                    if (action === 'spotlight') {
                      tileHostActions?.setSpotlight(identity)
                      return
                    }
                    if (action === 'remove_spotlight') {
                      tileHostActions?.setSpotlight(null)
                      return
                    }
                    if (action === 'lower_hand') {
                      tileHostActions?.lowerHandFor(identity)
                    }
                  }}
                >
                  {meetingTileActionLabel(action)}
                </button>
              ))}
            </div>
          ) : null}
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
              {nonverbal ? (
                <span className="sheconomy-nonverbal-inline">{meetingNonverbalEmoji(nonverbal)}</span>
              ) : null}
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
    const id = setInterval(boost, 1500)
    return () => clearInterval(id)
  }, [trackRef.participant.isLocal, trackRef.publication, trackRef.source])

  return null
}

function CameraHdQualityBooster({ enabled }: { enabled: boolean }) {
  const trackRef = useEnsureTrackRef()

  useEffect(() => {
    if (!enabled) return
    const publication = trackRef.publication
    if (!publication || trackRef.participant.isLocal) return
    if (trackRef.source !== Track.Source.Camera) return
    const remote = publication as RemoteTrackPublication
    try {
      if (!remote.isSubscribed) remote.setSubscribed(true)
      remote.setVideoQuality(VideoQuality.HIGH)
    } catch {
      // ignore
    }
  }, [enabled, trackRef.participant.isLocal, trackRef.publication, trackRef.source])

  return null
}
