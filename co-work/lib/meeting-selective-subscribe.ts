import type { RemoteTrackPublication, Room } from 'livekit-client'
import { Track } from 'livekit-client'

/**
 * Cap LiveKit camera subscriptions to identities that are actually on stage /
 * filmstrip. Screen shares always stay subscribed. Audio stays subscribed so
 * ~100-person rooms remain audible without decoding every camera.
 */
export function applyMeetingSelectiveCameraSubscribe(
  room: Room | null | undefined,
  visibleIdentities: ReadonlySet<string> | readonly string[],
): void {
  if (!room) return
  const visible =
    visibleIdentities instanceof Set
      ? visibleIdentities
      : new Set(visibleIdentities.filter(Boolean))

  for (const participant of room.remoteParticipants.values()) {
    const identity = participant.identity
    const wantVideo = visible.has(identity)
    for (const publication of participant.trackPublications.values()) {
      if (publication.kind !== 'video' && publication.source !== Track.Source.Camera) {
        // Always keep audio + screen-share subscribed.
        if (
          publication.source === Track.Source.ScreenShare ||
          publication.source === Track.Source.ScreenShareAudio ||
          publication.kind === 'audio'
        ) {
          ensureSubscribed(publication as RemoteTrackPublication, true)
        }
        continue
      }
      if (publication.source === Track.Source.ScreenShare) {
        ensureSubscribed(publication as RemoteTrackPublication, true)
        continue
      }
      if (publication.source === Track.Source.Camera) {
        ensureSubscribed(publication as RemoteTrackPublication, wantVideo)
      }
    }
  }
}

function ensureSubscribed(publication: RemoteTrackPublication, subscribed: boolean) {
  try {
    if (publication.isSubscribed === subscribed) return
    publication.setSubscribed(subscribed)
  } catch {
    // Soft-fail — SFU may reject mid-renegotiation.
  }
}
