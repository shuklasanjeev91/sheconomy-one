import { useEffect, useMemo, useRef, useState } from 'react'

import { Avatar } from '~/components/ui'
import {
  useMeetingLiveSignals,
  useParticipantHandRaised,
  useParticipantMeetingRole,
  useParticipantNonverbal,
} from '~/co-work/components/MeetingLiveSignalsContext'
import { MeetingRoleBadge } from '~/co-work/components/MeetingRoleBadge'
import type { MediasoupTrackRef } from '~/co-work/lib/mediasoup/mediasoup-stage-tracks'
import { MeetingVideoQuality } from '~/co-work/lib/meeting-selective-subscribe'
import { meetingNonverbalEmoji } from '~/co-work/lib/meeting-nonverbal'
import { meetingTileActionLabel, meetingTileMenuActions } from '~/co-work/lib/meeting-tile-actions'
import { meetingVideoMirrorTransform, shouldMirrorMeetingVideo } from '~/co-work/lib/meeting-video-mirror'

/** `<video>` bound to one MediaStreamTrack. */
export function MediasoupVideoElement({
  track,
  className,
  style,
}: {
  track: MediaStreamTrack
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.srcObject = new MediaStream([track])
    void node.play().catch(() => {})
    return () => {
      node.srcObject = null
    }
  }, [track])
  return <video ref={ref} className={className} style={style} autoPlay playsInline muted />
}

/** Branded meeting tile — markup and classes match the stage CSS. */
export function MediasoupParticipantTile({
  trackRef,
  mirrorLocalVideo = true,
  cameraQuality = MeetingVideoQuality.MEDIUM,
  onPreferredLayer,
  onScreenAttached,
}: {
  trackRef: MediasoupTrackRef
  mirrorLocalVideo?: boolean
  cameraQuality?: MeetingVideoQuality
  onPreferredLayer?: (userId: string, spatialLayer: number) => void
  onScreenAttached?: (userId: string) => void
}) {
  const participant = trackRef.participant
  const identity = participant.identity
  const name = participant.name || 'Guest'
  const handRaised = useParticipantHandRaised(identity)
  const nonverbal = useParticipantNonverbal(identity)
  const meetingRole = useParticipantMeetingRole(identity)
  const {
    stopIncomingVideo,
    localUserId,
    spotlightUserId,
    pinnedUserIds,
    togglePinnedUserId,
    tileHostActions,
  } = useMeetingLiveSignals()
  const [menuOpen, setMenuOpen] = useState(false)
  const isSelf = identity === localUserId || participant.isLocal
  const isPinned = pinnedUserIds.includes(identity)
  const isSpotlighted = spotlightUserId === identity
  const isScreen = trackRef.source === 'screen_share'
  const stopRemoteCamera = stopIncomingVideo && !participant.isLocal && !isScreen
  const isSpeaking = !isScreen && participant.isSpeaking
  const micMuted = !isScreen && !participant.isMicrophoneEnabled
  const videoTrack = stopRemoteCamera ? null : (trackRef.publication?.track ?? null)
  const cameraOff = !isScreen && !videoTrack

  useEffect(() => {
    if (isScreen || participant.isLocal || !trackRef.publication) return
    onPreferredLayer?.(identity, Number(cameraQuality))
  }, [cameraQuality, identity, isScreen, onPreferredLayer, participant.isLocal, trackRef.publication])

  useEffect(() => {
    if (!isScreen || participant.isLocal || !videoTrack) return
    const timer = setTimeout(() => onScreenAttached?.(identity), 250)
    return () => clearTimeout(timer)
  }, [identity, isScreen, onScreenAttached, participant.isLocal, videoTrack])

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

  const mirrored = shouldMirrorMeetingVideo({
    mirrorLocalVideo,
    isLocal: participant.isLocal,
    isScreenShare: isScreen,
    source: trackRef.source,
  })

  return (
    <div
      className="sheconomy-participant-tile lk-participant-tile"
      data-lk-source={trackRef.source}
      data-lk-speaking={isSpeaking ? 'true' : 'false'}
      data-lk-video-muted={cameraOff ? 'true' : 'false'}
      data-lk-local-participant={participant.isLocal ? 'true' : 'false'}
    >
      {videoTrack ? (
        <MediasoupVideoElement
          track={videoTrack}
          className={`lk-video-track${mirrored ? ' sheconomy-video--mirrored' : ''}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: isScreen ? 'contain' : 'cover',
            background: '#0c080a',
            transform: meetingVideoMirrorTransform(mirrored),
          }}
        />
      ) : null}

      {isScreen ? (
        !videoTrack ? (
          <div className="lk-participant-placeholder sheconomy-screen-waiting" data-camera-off="false">
            <span className="sheconomy-participant-avatar-label">Receiving screen…</span>
          </div>
        ) : null
      ) : (
        <div className="lk-participant-placeholder" data-camera-off={cameraOff ? 'true' : 'false'}>
          <div className="sheconomy-participant-avatar-wrap">
            <Avatar name={name} src={participant.avatarUrl ?? undefined} size="$8" />
            <span className="sheconomy-participant-avatar-label">
              {participant.isConnecting
                ? 'Connecting…'
                : stopRemoteCamera
                  ? 'Video paused'
                  : cameraOff
                    ? 'Camera off'
                    : name}
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
          {isScreen ? (
            <span className="lk-participant-name">{name}&apos;s screen</span>
          ) : (
            <>
              {micMuted ? (
                <span className="sheconomy-mic-muted" aria-label="Muted">
                  🔇
                </span>
              ) : null}
              <span className="lk-participant-name">{name}</span>
              {handRaised ? <span className="sheconomy-hand-raised-inline">✋</span> : null}
              {nonverbal ? (
                <span className="sheconomy-nonverbal-inline">{meetingNonverbalEmoji(nonverbal)}</span>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
