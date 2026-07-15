import {
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  type LocalParticipant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type ScreenShareCaptureOptions,
  type TrackPublication,
  type TrackPublishOptions,
} from 'livekit-client'

/** Prefer a single high-quality layer — mobile screen share often has no low simulcast. */
export const SCREEN_SHARE_SUBSCRIBE_DIMENSIONS = { width: 1920, height: 1080 } as const

export const SCREEN_SHARE_PUBLISH_OPTIONS: TrackPublishOptions = {
  simulcast: false,
  source: Track.Source.ScreenShare,
}

export const WEB_SCREEN_SHARE_CAPTURE: ScreenShareCaptureOptions = {
  audio: true,
  resolution: { width: 1920, height: 1080, frameRate: 15 },
  contentHint: 'detail',
}

export const NATIVE_SCREEN_SHARE_CAPTURE: ScreenShareCaptureOptions = {
  // Keep a stable resolution so web/native receivers always have a real layer.
  resolution: { width: 1280, height: 720, frameRate: 15 },
  contentHint: 'detail',
}

export function isScreenSharePublication(publication: TrackPublication | undefined | null): boolean {
  return publication?.source === Track.Source.ScreenShare
}

export function isScreenShareSource(source: Track.Source | undefined | null): boolean {
  return source === Track.Source.ScreenShare
}

export async function setLocalScreenShareEnabled(
  localParticipant: LocalParticipant,
  enabled: boolean,
  platform: 'web' | 'native',
): Promise<void> {
  if (!enabled) {
    await localParticipant.setScreenShareEnabled(false)
    return
  }

  const capture = platform === 'web' ? WEB_SCREEN_SHARE_CAPTURE : NATIVE_SCREEN_SHARE_CAPTURE
  await localParticipant.setScreenShareEnabled(true, capture, SCREEN_SHARE_PUBLISH_OPTIONS)
}

export function boostScreenSharePublication(publication: RemoteTrackPublication) {
  if (!isScreenSharePublication(publication)) return
  if (!publication.isSubscribed) {
    publication.setSubscribed(true)
  }
  // Prefer explicit dimensions so adaptiveStream doesn't request a missing low layer.
  publication.setVideoDimensions(SCREEN_SHARE_SUBSCRIBE_DIMENSIONS)
  publication.setVideoQuality(VideoQuality.HIGH)
  publication.setEnabled(true)
}

function boostParticipantScreenShares(participant: RemoteParticipant) {
  for (const publication of participant.trackPublications.values()) {
    if (publication.kind !== Track.Kind.Video) continue
    boostScreenSharePublication(publication as RemoteTrackPublication)
  }
}

/**
 * Keep remote screen shares subscribed at full quality on every viewer platform.
 * Without this, adaptiveStream can request a low layer a publisher never sent
 * (especially Android/iOS → web), so the stage tile stays empty/black.
 */
export function bindRemoteScreenShareQuality(room: Room): () => void {
  for (const participant of room.remoteParticipants.values()) {
    boostParticipantScreenShares(participant)
  }

  const onTrackPublished = (
    publication: RemoteTrackPublication,
    _participant: RemoteParticipant,
  ) => {
    boostScreenSharePublication(publication)
  }

  const onTrackSubscribed = (
    _track: RemoteTrack,
    publication: RemoteTrackPublication,
    _participant: RemoteParticipant,
  ) => {
    boostScreenSharePublication(publication)
  }

  const onParticipantConnected = (participant: RemoteParticipant) => {
    boostParticipantScreenShares(participant)
  }

  const onLocalTrackPublished = () => {
    // Re-boost remotes after local publish renegotiation (screen share toggle).
    for (const participant of room.remoteParticipants.values()) {
      boostParticipantScreenShares(participant)
    }
  }

  room.on(RoomEvent.TrackPublished, onTrackPublished)
  room.on(RoomEvent.TrackSubscribed, onTrackSubscribed)
  room.on(RoomEvent.ParticipantConnected, onParticipantConnected)
  room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished)

  return () => {
    room.off(RoomEvent.TrackPublished, onTrackPublished)
    room.off(RoomEvent.TrackSubscribed, onTrackSubscribed)
    room.off(RoomEvent.ParticipantConnected, onParticipantConnected)
    room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished)
  }
}
