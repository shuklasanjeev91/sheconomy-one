import { Track } from 'livekit-client'

import { isTrackReference, type TrackReferenceOrPlaceholder } from '@livekit/components-core'

import { isScreenSharePublication, isScreenShareSource } from '~/co-work/lib/livekit-screen-share'
import type { MeetingViewMode } from '~/co-work/lib/meeting-state-machine'

export type MeetingStageTracks = {
  stageTracks: TrackReferenceOrPlaceholder[]
  filmstripTracks: TrackReferenceOrPlaceholder[]
  pipTrack: TrackReferenceOrPlaceholder | null
  totalTiles: number
  hasScreenShare: boolean
  isLocalScreenSharing: boolean
}

function isScreenShareTrack(track: TrackReferenceOrPlaceholder) {
  if (isScreenShareSource(track.source)) return true
  return isTrackReference(track) && isScreenSharePublication(track.publication)
}

/**
 * Normalize camera + screen-share tracks into a focused stage layout that works
 * the same on web and native for every meeting direction.
 *
 * Gallery mode always returns every camera as equal stage tiles (paginated by
 * the UI). Speaker / screen-share modes focus one tile and move the rest to the
 * filmstrip — they must never leak into gallery.
 */
export function composeMeetingStageTracks(
  tracks: TrackReferenceOrPlaceholder[],
  localIdentity: string,
  viewMode: MeetingViewMode = 'gallery',
  activeSpeakerIdentity?: string | null,
  hideSelfView = false,
): MeetingStageTracks {
  const screenShares: TrackReferenceOrPlaceholder[] = []
  const cameraByIdentity = new Map<string, TrackReferenceOrPlaceholder>()

  for (const track of tracks) {
    if (isScreenShareTrack(track)) {
      if (isTrackReference(track)) screenShares.push(track)
      continue
    }

    if (track.source !== Track.Source.Camera) continue

    const identity = track.participant.identity
    const existing = cameraByIdentity.get(identity)
    if (!existing) {
      cameraByIdentity.set(identity, track)
      continue
    }

    if (!isTrackReference(existing) && isTrackReference(track)) {
      cameraByIdentity.set(identity, track)
    }
  }

  const cameras = [...cameraByIdentity.values()]
  const remoteScreens = screenShares.filter((track) => track.participant.identity !== localIdentity)
  const localScreens = screenShares.filter((track) => track.participant.identity === localIdentity)
  const isLocalScreenSharing = localScreens.length > 0
  // Never render the presenter's own captured display back into that display.
  // Doing so creates the infinite "hall of mirrors" shown by every screen recorder.
  // The local publication remains live and remote participants still receive it.
  const focusedScreen = remoteScreens[0] ?? null

  const localCamera =
    cameras.find((track) => track.participant.identity === localIdentity) ?? null
  const remoteCameras = cameras.filter((track) => track.participant.identity !== localIdentity)
  // Active speaker first among remotes, then remaining remotes, then local — gallery
  // still shows everyone; order only affects page-1 prominence.
  const remotesOrdered = [...remoteCameras].sort((left, right) => {
    const leftActive =
      left.participant.identity === activeSpeakerIdentity || left.participant.isSpeaking ? 1 : 0
    const rightActive =
      right.participant.identity === activeSpeakerIdentity || right.participant.isSpeaking ? 1 : 0
    return rightActive - leftActive
  })
  const includeLocal = !hideSelfView && !!localCamera
  const orderedCameras = [...remotesOrdered, ...(includeLocal && localCamera ? [localCamera] : [])]

  // True gallery — every camera is a stage tile. Never collapse to a single focus.
  if (viewMode === 'gallery') {
    return {
      stageTracks: orderedCameras,
      filmstripTracks: [],
      pipTrack: null,
      totalTiles: orderedCameras.length,
      hasScreenShare: !!focusedScreen || isLocalScreenSharing,
      isLocalScreenSharing,
    }
  }

  if (focusedScreen && viewMode === 'screen-share') {
    return {
      stageTracks: [focusedScreen],
      filmstripTracks: [...remoteCameras, ...(includeLocal && localCamera ? [localCamera] : [])],
      pipTrack: null,
      totalTiles: remoteCameras.length + (includeLocal ? 1 : 0) + 1,
      hasScreenShare: true,
      isLocalScreenSharing,
    }
  }

  if (isLocalScreenSharing && viewMode === 'screen-share') {
    // Do not render the presenter's capture back into the captured display:
    // whole-screen sharing would create an infinite mirror. Keep an active
    // participant in the main area and every camera (including self) in the
    // filmstrip so presenting never hides the room.
    const activeSpeaker =
      remoteCameras.find((track) => track.participant.identity === activeSpeakerIdentity) ??
      remoteCameras.find((track) => track.participant.isSpeaking) ??
      remoteCameras[0] ??
      (includeLocal ? localCamera : null)

    return {
      stageTracks: activeSpeaker ? [activeSpeaker] : [],
      filmstripTracks: orderedCameras,
      pipTrack: null,
      totalTiles: orderedCameras.length,
      hasScreenShare: true,
      isLocalScreenSharing: true,
    }
  }

  // Speaker (or screen-share without a focused remote share) — one main tile.
  // Active speaker may be local or remote; filmstrip holds everyone else.
  const activeSpeaker =
    orderedCameras.find((track) => track.participant.identity === activeSpeakerIdentity) ??
    orderedCameras.find((track) => track.participant.isSpeaking) ??
    remoteCameras[0] ??
    (includeLocal ? localCamera : null)
  const stageTracks = activeSpeaker ? [activeSpeaker] : []
  return {
    stageTracks,
    filmstripTracks: orderedCameras.filter((track) => track !== activeSpeaker),
    pipTrack: null,
    totalTiles: orderedCameras.length,
    hasScreenShare: !!focusedScreen || isLocalScreenSharing,
    isLocalScreenSharing,
  }
}
