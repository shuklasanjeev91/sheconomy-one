import type { RemoteTrackPublication, Room } from 'livekit-client'
import { Track } from 'livekit-client'

/** Below this remote count, subscribe every camera (Zoom-like small/medium rooms). */
export const MEETING_SUBSCRIBE_ALL_BELOW = 25

/**
 * Cap LiveKit camera subscriptions to identities that are actually on stage /
 * filmstrip. Screen shares always stay subscribed. Audio stays subscribed so
 * ~100-person rooms remain audible without decoding every camera.
 *
 * When remote peer count is small (≤ MEETING_SUBSCRIBE_ALL_BELOW), subscribe
 * every remote camera so 1–N joiners always see each other without paging races.
 */
export function applyMeetingSelectiveCameraSubscribe(
  room: Room | null | undefined,
  visibleIdentities: ReadonlySet<string> | readonly string[],
  options?: { subscribeAllBelow?: number },
): void {
  if (!room) return
  const subscribeAllBelow = options?.subscribeAllBelow ?? MEETING_SUBSCRIBE_ALL_BELOW
  const remoteCount = room.remoteParticipants.size
  const visible =
    remoteCount <= subscribeAllBelow
      ? new Set(
          [...room.remoteParticipants.keys()].filter(Boolean),
        )
      : visibleIdentities instanceof Set
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

/** Pure helper for tests — which identities should receive camera subscribe. */
export function resolveSubscribeCameraIdentities(input: {
  remoteIdentities: readonly string[]
  pageIdentities: readonly string[]
  filmstripIdentities?: readonly string[]
  speakingIdentities?: readonly string[]
  subscribeAllBelow?: number
}): string[] {
  const threshold = input.subscribeAllBelow ?? MEETING_SUBSCRIBE_ALL_BELOW
  if (input.remoteIdentities.length <= threshold) {
    return [...new Set(input.remoteIdentities.filter(Boolean))]
  }
  return [
    ...new Set(
      [
        ...input.pageIdentities,
        ...(input.filmstripIdentities ?? []),
        ...(input.speakingIdentities ?? []),
      ].filter(Boolean),
    ),
  ]
}
