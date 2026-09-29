import { Track } from 'livekit-client'

import { isTrackReference, type TrackReferenceOrPlaceholder } from '@livekit/components-core'

import { isScreenSharePublication, isScreenShareSource } from '~/co-work/lib/livekit-screen-share'
import {
  normalizePinnedIdentities,
  resolveMeetingFocusIdentity,
} from '~/co-work/lib/meeting-stage-focus'
import type { MeetingViewMode } from '~/co-work/lib/meeting-state-machine'
import { participantDisplayName } from '~/co-work/lib/participant-avatar'
import {
  compareMeetingActivity,
  type MeetingActivitySignals,
} from '~/co-work/lib/meeting-participant-order'

export type MeetingStageTracks = {
  stageTracks: TrackReferenceOrPlaceholder[]
  filmstripTracks: TrackReferenceOrPlaceholder[]
  pipTrack: TrackReferenceOrPlaceholder | null
  totalTiles: number
  /** Camera tiles the gallery pages show, independent of the current view. */
  cameraTiles: number
  hasScreenShare: boolean
  isLocalScreenSharing: boolean
}

export type MeetingStageFocusInput = {
  hideSelfView?: boolean
  /** Drop remote (and optional local) tiles whose camera is off. */
  hideNonVideoParticipants?: boolean
  /** Keep only speaking / pinned / spotlight / local tiles in gallery. */
  activeSpeakersOnly?: boolean
  /** Host spotlight — forces focused stage for every viewer. */
  spotlightIdentity?: string | null
  /** Local pins — floated to the front of gallery / preferred in speaker. */
  pinnedIdentities?: string[]
}

function isScreenShareTrack(track: TrackReferenceOrPlaceholder) {
  if (isScreenShareSource(track.source)) return true
  return isTrackReference(track) && isScreenSharePublication(track.publication)
}

/** Prefer live camera tiles ahead of camera-off avatars in gallery / filmstrip. */
export function meetingCameraVideoPriority(track: TrackReferenceOrPlaceholder): number {
  const participant = track.participant as { isCameraEnabled?: boolean; isSpeaking?: boolean }
  if (typeof participant.isCameraEnabled === 'boolean') {
    return participant.isCameraEnabled ? 1 : 0
  }
  if (!isTrackReference(track)) return 0
  const publication = track.publication as { isMuted?: boolean; track?: unknown } | undefined
  if (!publication) return 0
  if (publication.isMuted) return 0
  return publication.track ? 1 : 0
}

function galleryActivitySignals(
  track: TrackReferenceOrPlaceholder,
  activeSpeakerIdentity: string | null | undefined,
  localIdentity: string,
): MeetingActivitySignals {
  const participant = track.participant as typeof track.participant & {
    isMicrophoneEnabled?: boolean
  }
  return {
    id: participant.identity,
    self: participant.identity === localIdentity,
    name: participantDisplayName(participant),
    activeSpeaker: !!activeSpeakerIdentity && participant.identity === activeSpeakerIdentity,
    speaking: !!participant.isSpeaking,
    micOn: participant.isMicrophoneEnabled === true,
    videoOn: meetingCameraVideoPriority(track) > 0,
  }
}

function compareGalleryCameras(
  left: TrackReferenceOrPlaceholder,
  right: TrackReferenceOrPlaceholder,
  activeSpeakerIdentity: string | null | undefined,
  pinnedSet: Set<string>,
  localIdentity: string,
): number {
  const leftPinned = pinnedSet.has(left.participant.identity) ? 1 : 0
  const rightPinned = pinnedSet.has(right.participant.identity) ? 1 : 0
  if (rightPinned !== leftPinned) return rightPinned - leftPinned
  return compareMeetingActivity(
    galleryActivitySignals(left, activeSpeakerIdentity, localIdentity),
    galleryActivitySignals(right, activeSpeakerIdentity, localIdentity),
  )
}

/**
 * Normalize camera + screen-share tracks into a focused stage layout.
 * Host spotlight forces a speaker-style focus for every viewer.
 */
export function composeMeetingStageTracks(
  tracks: TrackReferenceOrPlaceholder[],
  localIdentity: string,
  viewMode: MeetingViewMode = 'gallery',
  activeSpeakerIdentity?: string | null,
  hideSelfViewOrFocus: boolean | MeetingStageFocusInput = false,
  spotlightIdentityArg?: string | null,
  pinnedIdentitiesArg?: string[],
): MeetingStageTracks {
  const focus: MeetingStageFocusInput =
    typeof hideSelfViewOrFocus === 'boolean'
      ? {
          hideSelfView: hideSelfViewOrFocus,
          spotlightIdentity: spotlightIdentityArg,
          pinnedIdentities: pinnedIdentitiesArg,
        }
      : hideSelfViewOrFocus

  const hideSelfView = focus.hideSelfView === true
  const hideNonVideo = focus.hideNonVideoParticipants === true
  const activeSpeakersOnly = focus.activeSpeakersOnly === true
  const spotlightIdentity = focus.spotlightIdentity ?? null
  const pinnedIdentities = normalizePinnedIdentities(focus.pinnedIdentities ?? [])
  const pinnedSet = new Set(pinnedIdentities)
  const focusIdentity = resolveMeetingFocusIdentity({
    spotlightIdentity,
    activeSpeakerIdentity,
  })

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

  const cameras = [...cameraByIdentity.values()].filter((track) => {
    const identity = track.participant.identity
    const keepFocus =
      identity === focusIdentity ||
      pinnedSet.has(identity) ||
      (!!spotlightIdentity && identity === spotlightIdentity) ||
      identity === localIdentity

    if (hideNonVideo && meetingCameraVideoPriority(track) <= 0 && !keepFocus) {
      return false
    }
    if (activeSpeakersOnly) {
      if (keepFocus) return true
      const speaking =
        track.participant.isSpeaking || identity === activeSpeakerIdentity
      return !!speaking
    }
    return true
  })
  const remoteScreens = screenShares.filter((track) => track.participant.identity !== localIdentity)
  const localScreens = screenShares.filter((track) => track.participant.identity === localIdentity)
  const isLocalScreenSharing = localScreens.length > 0
  const focusedScreen = remoteScreens[0] ?? null

  const localCamera =
    cameras.find((track) => track.participant.identity === localIdentity) ?? null
  const remoteCameras = cameras.filter((track) => track.participant.identity !== localIdentity)
  const includeLocal = !hideSelfView && !!localCamera
  const orderedCameras = [...remoteCameras, ...(includeLocal && localCamera ? [localCamera] : [])].sort(
    (left, right) => compareGalleryCameras(left, right, focusIdentity, pinnedSet, localIdentity),
  )

  if (spotlightIdentity) {
    const spotlightTrack =
      orderedCameras.find((track) => track.participant.identity === spotlightIdentity) ?? null
    if (spotlightTrack) {
      return {
        stageTracks: [spotlightTrack],
        filmstripTracks: orderedCameras.filter((track) => track !== spotlightTrack),
        pipTrack: null,
        totalTiles: orderedCameras.length,
        cameraTiles: orderedCameras.length,
        hasScreenShare: !!focusedScreen || isLocalScreenSharing,
        isLocalScreenSharing,
      }
    }
  }

  if (viewMode === 'gallery') {
    return {
      stageTracks: orderedCameras,
      filmstripTracks: [],
      pipTrack: null,
      totalTiles: orderedCameras.length,
      cameraTiles: orderedCameras.length,
      hasScreenShare: !!focusedScreen || isLocalScreenSharing,
      isLocalScreenSharing,
    }
  }

  if (focusedScreen && viewMode === 'screen-share') {
    return {
      stageTracks: [focusedScreen],
      filmstripTracks: orderedCameras,
      pipTrack: null,
      totalTiles: remoteCameras.length + (includeLocal ? 1 : 0) + 1,
      cameraTiles: orderedCameras.length,
      hasScreenShare: true,
      isLocalScreenSharing,
    }
  }

  if (isLocalScreenSharing && viewMode === 'screen-share') {
    const activeSpeaker =
      remoteCameras.find((track) => track.participant.identity === focusIdentity) ??
      remoteCameras.find((track) => track.participant.isSpeaking) ??
      remoteCameras[0] ??
      (includeLocal ? localCamera : null)

    return {
      stageTracks: activeSpeaker ? [activeSpeaker] : [],
      filmstripTracks: orderedCameras,
      pipTrack: null,
      totalTiles: orderedCameras.length,
      cameraTiles: orderedCameras.length,
      hasScreenShare: true,
      isLocalScreenSharing: true,
    }
  }

  // Zoom 1:1 active speaker: the other person fills the stage, self-view floats on top.
  const oneOnOneRemote = remoteCameras.length === 1 ? remoteCameras[0] : null
  if (
    oneOnOneRemote &&
    includeLocal &&
    localCamera &&
    cameraByIdentity.size === 2 &&
    screenShares.length === 0 &&
    pinnedIdentities.length === 0
  ) {
    return {
      stageTracks: [oneOnOneRemote],
      filmstripTracks: [],
      pipTrack: localCamera,
      totalTiles: 2,
      cameraTiles: orderedCameras.length,
      hasScreenShare: false,
      isLocalScreenSharing: false,
    }
  }

  const preferredPin = pinnedIdentities
    .map((id) => orderedCameras.find((track) => track.participant.identity === id))
    .find(Boolean)
  const activeSpeaker =
    preferredPin ??
    orderedCameras.find((track) => track.participant.identity === focusIdentity) ??
    orderedCameras.find((track) => track.participant.isSpeaking) ??
    remoteCameras[0] ??
    (includeLocal ? localCamera : null)
  const stageTracks = activeSpeaker ? [activeSpeaker] : []
  return {
    stageTracks,
    filmstripTracks: orderedCameras.filter((track) => track !== activeSpeaker),
    pipTrack: null,
    totalTiles: orderedCameras.length,
    cameraTiles: orderedCameras.length,
    hasScreenShare: !!focusedScreen || isLocalScreenSharing,
    isLocalScreenSharing,
  }
}
