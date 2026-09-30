import type { MeetingStageTrack } from '~/co-work/lib/meeting-stage-tracks'
import type { MediasoupRemoteTrack, MediasoupRoomSnapshot } from '~/co-work/lib/mediasoup/mediasoup-room'

export type MediasoupTileParticipant = {
  /** Supabase user id — the identity used by roster, pins and spotlight. */
  identity: string
  peerId: string
  name: string
  avatarUrl: string | null
  isLocal: boolean
  isSpeaking: boolean
  isCameraEnabled: boolean
  isMicrophoneEnabled: boolean
}

export type MediasoupTileSource = 'camera' | 'screen_share'

export type MediasoupTrackRef = MeetingStageTrack & {
  source: MediasoupTileSource
  participant: MediasoupTileParticipant
  /** Absent when the camera is off (avatar placeholder). */
  publication?: { source: MediasoupTileSource; isMuted: boolean; track: MediaStreamTrack }
  /** Remote consumer, `null` for local tracks. */
  consumerId: string | null
}

export function mediasoupTrackKey(track: MediasoupTrackRef): string {
  return `${track.participant.peerId}:${track.source}`
}

export function mediasoupVideoTrackOf(track: MediasoupTrackRef | null | undefined): MediaStreamTrack | null {
  return track?.publication?.track ?? null
}

/** Camera tiles (with placeholders) + screen shares for every peer in the room. */
export function mediasoupStageTrackRefs(
  snapshot: MediasoupRoomSnapshot,
  local: { peerId: string; userId: string; displayName: string; avatarUrl: string | null },
): MediasoupTrackRef[] {
  const speaking = new Set(snapshot.speakingPeerIds)
  const refs: MediasoupTrackRef[] = []

  const localParticipant: MediasoupTileParticipant = {
    identity: local.userId,
    peerId: local.peerId,
    name: local.displayName,
    avatarUrl: local.avatarUrl,
    isLocal: true,
    isSpeaking: speaking.has(local.peerId),
    isCameraEnabled: snapshot.local.cameraEnabled && !!snapshot.local.cameraTrack,
    isMicrophoneEnabled: snapshot.local.micEnabled,
  }
  refs.push({
    source: 'camera',
    participant: localParticipant,
    consumerId: null,
    ...(localParticipant.isCameraEnabled && snapshot.local.cameraTrack
      ? { publication: { source: 'camera', isMuted: false, track: snapshot.local.cameraTrack } }
      : {}),
  })
  if (snapshot.local.screenSharing && snapshot.local.screenTrack) {
    refs.push({
      source: 'screen_share',
      participant: localParticipant,
      consumerId: null,
      publication: { source: 'screen_share', isMuted: false, track: snapshot.local.screenTrack },
    })
  }

  for (const peer of snapshot.peers) {
    const video = peer.video
    const cameraOn = !!video && !video.producerPaused
    const participant: MediasoupTileParticipant = {
      identity: peer.userId,
      peerId: peer.peerId,
      name: peer.displayName,
      avatarUrl: peer.avatarUrl,
      isLocal: false,
      isSpeaking: speaking.has(peer.peerId),
      isCameraEnabled: cameraOn,
      isMicrophoneEnabled: !!peer.audio && !peer.audio.producerPaused,
    }
    refs.push({
      source: 'camera',
      participant,
      consumerId: video?.consumerId ?? null,
      ...(cameraOn && video
        ? { publication: { source: 'camera', isMuted: false, track: video.track } }
        : {}),
    })
    if (liveRemoteTrack(peer.screen) && peer.screen) {
      refs.push({
        source: 'screen_share',
        participant,
        consumerId: peer.screen.consumerId,
        publication: { source: 'screen_share', isMuted: false, track: peer.screen.track },
      })
    }
  }

  return refs
}

/**
 * Remote cameras to keep flowing. Small rooms receive everyone (no paging
 * races); larger ones only what is on screen. `null` = everyone.
 */
export function mediasoupVisibleUserIds(
  visibleIdentities: ReadonlySet<string>,
  remotePeerCount: number,
  subscribeAllBelow: number,
): Set<string> | null {
  if (remotePeerCount <= subscribeAllBelow) return null
  return new Set(visibleIdentities)
}

/** Active speaker by user id; the local peer counts too. */
export function mediasoupActiveSpeakerIdentity(
  snapshot: MediasoupRoomSnapshot,
  local: { peerId: string; userId: string },
): string | null {
  const peerId = snapshot.activeSpeakerPeerId
  if (!peerId) return null
  if (peerId === local.peerId) return local.userId
  return snapshot.peers.find((peer) => peer.peerId === peerId)?.userId ?? null
}

export function mediasoupSpeakingIdentities(
  snapshot: MediasoupRoomSnapshot,
  local: { peerId: string; userId: string },
): string[] {
  const ids = new Set<string>()
  for (const peerId of snapshot.speakingPeerIds) {
    if (peerId === local.peerId) {
      ids.add(local.userId)
      continue
    }
    const peer = snapshot.peers.find((candidate) => candidate.peerId === peerId)
    if (peer) ids.add(peer.userId)
  }
  return [...ids]
}

function liveRemoteTrack(remote: MediasoupRemoteTrack | null | undefined): MediaStreamTrack | null {
  if (!remote || remote.producerPaused || remote.track.readyState === 'ended') return null
  return remote.track
}

/** Someone else is presenting a live screen right now. */
export function mediasoupViewingScreenShare(snapshot: MediasoupRoomSnapshot): boolean {
  return mediasoupScreenShareIdentity(snapshot) !== null
}

/** User id of the remote peer presenting a live screen, if any. */
export function mediasoupScreenShareIdentity(snapshot: MediasoupRoomSnapshot): string | null {
  return snapshot.peers.find((peer) => !!liveRemoteTrack(peer.screen))?.userId ?? null
}

/** Mini-player video: remote screen share, active speaker, any remote camera, then self. */
export function mediasoupFeaturedVideo(
  snapshot: MediasoupRoomSnapshot,
  selfMirrorAllowed = true,
): { track: MediaStreamTrack; mirrored: boolean } | null {
  for (const peer of snapshot.peers) {
    const screen = liveRemoteTrack(peer.screen)
    if (screen) return { track: screen, mirrored: false }
  }
  const speaker = snapshot.peers.find((peer) => peer.peerId === snapshot.activeSpeakerPeerId)
  const speakerCamera = liveRemoteTrack(speaker?.video)
  if (speakerCamera) return { track: speakerCamera, mirrored: false }
  for (const peer of snapshot.peers) {
    const camera = liveRemoteTrack(peer.video)
    if (camera) return { track: camera, mirrored: false }
  }
  const local = snapshot.local.cameraTrack
  if (snapshot.local.cameraEnabled && local) {
    return { track: local, mirrored: selfMirrorAllowed && snapshot.local.cameraFacing === 'user' }
  }
  return null
}
