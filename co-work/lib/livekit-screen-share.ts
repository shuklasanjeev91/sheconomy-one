import {
  Room,
  RoomEvent,
  ScreenSharePresets,
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

import {
  forceScreenShareTrackSettings,
  patchLiveKitWaitForDimensions,
} from '~/co-work/lib/livekit-patch-dimensions'

// Apply as soon as meeting screen-share code loads (web + native).
patchLiveKitWaitForDimensions()

/** Prefer a single mid/high layer so adaptiveStream never asks for a missing low simulcast. */
export const SCREEN_SHARE_SUBSCRIBE_DIMENSIONS = { width: 1280, height: 720 } as const

/**
 * Publish options for screen share.
 * Use `screenShareEncoding` (not `videoEncoding`) — LiveKit's computeVideoEncodings
 * only reads screenShareEncoding when source is ScreenShare.
 *
 * Force VP8 + no simulcast so web ↔ iOS ↔ Android all subscribe the same layer.
 */
export const SCREEN_SHARE_PUBLISH_OPTIONS: TrackPublishOptions = {
  source: Track.Source.ScreenShare,
  videoCodec: 'vp8',
  simulcast: false,
  screenShareSimulcastLayers: [],
  screenShareEncoding: ScreenSharePresets.h720fps15.encoding,
  backupCodec: false,
}

export const WEB_SCREEN_SHARE_CAPTURE: ScreenShareCaptureOptions = {
  // System audio is optional and fails on many browsers; video is required.
  audio: false,
  resolution: ScreenSharePresets.h720fps15.resolution,
  contentHint: 'detail',
  // Prefer sharing a tab/window rather than the meeting page itself (blank recursion).
  // Modern Chromium/Edge/Firefox present Entire screen / Window / Browser tab in one picker.
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'include',
  preferCurrentTab: false,
}

/** Native getDisplayMedia ignores most web-only constraints — keep this minimal. */
export const NATIVE_SCREEN_SHARE_CAPTURE: ScreenShareCaptureOptions = {
  audio: false,
  resolution: ScreenSharePresets.h720fps15.resolution,
}

export function isScreenSharePublication(publication: TrackPublication | undefined | null): boolean {
  return publication?.source === Track.Source.ScreenShare
}

export function isScreenShareSource(source: Track.Source | undefined | null): boolean {
  return source === Track.Source.ScreenShare
}

async function waitForLocalScreenShareTrack(
  localParticipant: LocalParticipant,
  timeoutMs = 8_000,
): Promise<TrackPublication | null> {
  const existing = localParticipant.getTrackPublication(Track.Source.ScreenShare)
  if (existing?.track) return existing

  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const publication = localParticipant.getTrackPublication(Track.Source.ScreenShare)
    if (publication?.track) return publication
  }
  return localParticipant.getTrackPublication(Track.Source.ScreenShare) ?? null
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

  // Ensure the published track is unmuted/enabled after the OS capture sheet.
  // On native, the MediaStream can attach a moment after setScreenShareEnabled resolves.
  const publication = await waitForLocalScreenShareTrack(localParticipant)
  if (publication?.track) {
    if (publication.isMuted) {
      await publication.unmute()
    }
    const mediaTrack = publication.track.mediaStreamTrack
    if (mediaTrack && 'enabled' in mediaTrack) {
      mediaTrack.enabled = true
    }
    // iOS ReplayKit / Android MediaProjection often report 0×0 until the first
    // frame — force settings so publish + remote RTCView get real dimensions.
    if (platform === 'native') {
      forceScreenShareTrackSettings(mediaTrack)
      // Content hint helps Android WebRTC pick a screen-share encode path.
      if (mediaTrack && 'contentHint' in mediaTrack) {
        try {
          ;(mediaTrack as MediaStreamTrack & { contentHint?: string }).contentHint = 'detail'
        } catch {
          // ignore
        }
      }
      // Wait briefly for MediaProjection/ReplayKit to attach a real MediaStream.
      // Publishing without frames makes remote iOS/web tiles stay blank.
      const started = Date.now()
      while (Date.now() - started < 4_000) {
        const stream = publication.track.mediaStream
        const live = publication.track.mediaStreamTrack
        const settings = live?.getSettings?.() ?? {}
        const w = Number(settings.width) || 0
        const h = Number(settings.height) || 0
        if (stream?.id && (w > 1 || live?.readyState === 'live')) break
        await new Promise((resolve) => setTimeout(resolve, 200))
        forceScreenShareTrackSettings(publication.track.mediaStreamTrack)
      }
    }
  }
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
 * (especially Android/iOS → web), so the stage tile stays empty.
 */
export function bindRemoteScreenShareQuality(room: Room): () => void {
  const boostAllRemotes = () => {
    for (const participant of room.remoteParticipants.values()) {
      boostParticipantScreenShares(participant)
    }
  }

  boostAllRemotes()

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
    boostAllRemotes()
  }

  const onTrackStreamStateChanged = (
    _publication: RemoteTrackPublication,
    _streamState: unknown,
    participant: RemoteParticipant,
  ) => {
    if (participant.isLocal) return
    boostParticipantScreenShares(participant)
  }

  room.on(RoomEvent.TrackPublished, onTrackPublished)
  room.on(RoomEvent.TrackSubscribed, onTrackSubscribed)
  room.on(RoomEvent.ParticipantConnected, onParticipantConnected)
  room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished)
  room.on(RoomEvent.TrackStreamStateChanged, onTrackStreamStateChanged)

  // Adaptive stream / SFU can renegotiate shortly after subscribe — re-assert.
  const reinforce = setInterval(boostAllRemotes, 1500)
  const stopReinforce = setTimeout(() => clearInterval(reinforce), 45_000)

  return () => {
    clearInterval(reinforce)
    clearTimeout(stopReinforce)
    room.off(RoomEvent.TrackPublished, onTrackPublished)
    room.off(RoomEvent.TrackSubscribed, onTrackSubscribed)
    room.off(RoomEvent.ParticipantConnected, onParticipantConnected)
    room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished)
    room.off(RoomEvent.TrackStreamStateChanged, onTrackStreamStateChanged)
  }
}
