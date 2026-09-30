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

/**
 * What stage ordering reads from a tile; a missing `publication` means camera
 * placeholder.
 */
export type MeetingStageTrack = {
  source: string
  participant: {
    identity: string
    name?: string
    isSpeaking?: boolean
    isCameraEnabled?: boolean
    isMicrophoneEnabled?: boolean
  }
  publication?: { source?: string; isMuted?: boolean; track?: unknown }
}

const CAMERA_SOURCE = 'camera'
const SCREEN_SHARE_SOURCE = 'screen_share'

export type MeetingStageTracks<T extends MeetingStageTrack = MeetingStageTrack> = {
  stageTracks: T[]
  filmstripTracks: T[]
  pipTrack: T | null
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

function isScreenShareTrack(track: MeetingStageTrack) {
  return track.source === SCREEN_SHARE_SOURCE || track.publication?.source === SCREEN_SHARE_SOURCE
}

/** Prefer live camera tiles ahead of camera-off avatars in gallery / filmstrip. */
export function meetingCameraVideoPriority(track: MeetingStageTrack): number {
  const participant = track.participant
  if (typeof participant.isCameraEnabled === 'boolean') {
    return participant.isCameraEnabled ? 1 : 0
  }
  const publication = track.publication
  if (!publication) return 0
  if (publication.isMuted) return 0
  return publication.track ? 1 : 0
}

function galleryActivitySignals(
  track: MeetingStageTrack,
  activeSpeakerIdentity: string | null | undefined,
  localIdentity: string,
): MeetingActivitySignals {
  const participant = track.participant
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
  left: MeetingStageTrack,
  right: MeetingStageTrack,
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
export function composeMeetingStageTracks<T extends MeetingStageTrack>(
  tracks: T[],
  localIdentity: string,
  viewMode: MeetingViewMode = 'gallery',
  activeSpeakerIdentity?: string | null,
  hideSelfViewOrFocus: boolean | MeetingStageFocusInput = false,
  spotlightIdentityArg?: string | null,
  pinnedIdentitiesArg?: string[],
): MeetingStageTracks<T> {
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

  const screenShares: T[] = []
  const cameraByIdentity = new Map<string, T>()

  for (const track of tracks) {
    if (isScreenShareTrack(track)) {
      if (track.publication) screenShares.push(track)
      continue
    }

    if (track.source !== CAMERA_SOURCE) continue

    const identity = track.participant.identity
    const existing = cameraByIdentity.get(identity)
    if (!existing) {
      cameraByIdentity.set(identity, track)
      continue
    }

    if (!existing.publication && track.publication) {
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

  const hasScreenShare = !!focusedScreen || isLocalScreenSharing
  const spotlightTrack = spotlightIdentity
    ? orderedCameras.find((track) => track.participant.identity === spotlightIdentity)
    : undefined

  if (viewMode === 'gallery' && !spotlightTrack) {
    return {
      stageTracks: orderedCameras,
      filmstripTracks: [],
      pipTrack: null,
      totalTiles: orderedCameras.length,
      cameraTiles: orderedCameras.length,
      hasScreenShare,
      isLocalScreenSharing,
    }
  }

  // Zoom one-on-one: exactly one large tile and one floating tile; everyone else
  // lives on the gallery page, never in a strip beside the stage.
  const remoteOrdered = orderedCameras.filter((track) => track.participant.identity !== localIdentity)
  const remoteSpeaker =
    remoteOrdered.find((track) => track.participant.identity === focusIdentity) ??
    remoteOrdered.find((track) => track.participant.isSpeaking) ??
    null

  if (focusedScreen && viewMode === 'screen-share' && !spotlightTrack) {
    const presenterCamera =
      remoteOrdered.find(
        (track) => track.participant.identity === focusedScreen.participant.identity,
      ) ?? null
    return {
      stageTracks: [focusedScreen],
      filmstripTracks: [],
      pipTrack: remoteSpeaker ?? presenterCamera ?? (includeLocal ? localCamera : null),
      totalTiles: remoteCameras.length + (includeLocal ? 1 : 0) + 1,
      cameraTiles: orderedCameras.length,
      hasScreenShare: true,
      isLocalScreenSharing,
    }
  }

  const preferredPin = pinnedIdentities
    .map((id) => orderedCameras.find((track) => track.participant.identity === id))
    .find(Boolean)
  const activeSpeaker =
    spotlightTrack ??
    preferredPin ??
    remoteSpeaker ??
    remoteOrdered[0] ??
    (includeLocal ? localCamera : null)
  const selfFloats = includeLocal && !!localCamera && !!activeSpeaker && activeSpeaker !== localCamera
  return {
    stageTracks: activeSpeaker ? [activeSpeaker] : [],
    filmstripTracks: [],
    pipTrack: selfFloats ? localCamera : null,
    totalTiles: orderedCameras.length,
    cameraTiles: orderedCameras.length,
    hasScreenShare,
    isLocalScreenSharing,
  }
}
