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
  nativeCapturerReportsVideoSize,
  patchLiveKitWaitForDimensions,
  peekUnpatchedVideoSize,
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
  // Callers can override via resolveScreenShareCapture({ shareComputerSound: true }).
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

/** Zoom-style share options applied when starting capture. */
export type ScreenShareStartOptions = {
  shareComputerSound?: boolean
  optimizeForVideo?: boolean
}

/** Build capture options for web/native from Zoom share prefs. */
export function resolveScreenShareCapture(
  platform: 'web' | 'native',
  options?: ScreenShareStartOptions | null,
): ScreenShareCaptureOptions {
  const shareSound = options?.shareComputerSound === true
  const forVideo = options?.optimizeForVideo === true
  const contentHint = forVideo ? 'motion' : 'detail'
  if (platform === 'web') {
    return {
      ...WEB_SCREEN_SHARE_CAPTURE,
      audio: shareSound,
      contentHint,
    }
  }
  return {
    ...NATIVE_SCREEN_SHARE_CAPTURE,
    audio: shareSound,
    contentHint,
  }
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

/** True when a published screen-share track looks ready to send frames. */
export function isLocalScreenShareTrackReady(
  publication: TrackPublication | null | undefined,
): boolean {
  const track = publication?.track
  if (!track) return false
  const media = track.mediaStreamTrack
  if (!media) return false
  if (media.readyState === 'ended') return false
  if ('enabled' in media && media.enabled === false) return false
  return true
}

export async function setLocalScreenShareEnabled(
  localParticipant: LocalParticipant,
  enabled: boolean,
  platform: 'web' | 'native',
  options?: ScreenShareStartOptions | null,
): Promise<void> {
  if (!enabled) {
    await localParticipant.setScreenShareEnabled(false)
    return
  }

  const capture = resolveScreenShareCapture(platform, options)
  await localParticipant.setScreenShareEnabled(true, capture, SCREEN_SHARE_PUBLISH_OPTIONS)

  // Ensure the published track is unmuted/enabled after the OS capture sheet.
  // On native, the MediaStream can attach a moment after setScreenShareEnabled resolves.
  // iOS ReplayKit "Start Broadcast" can take well over 8s after the picker.
  const publication = await waitForLocalScreenShareTrack(
    localParticipant,
    platform === 'native' ? 25_000 : 8_000,
  )
  if (!publication?.track) {
    throw new Error(
      platform === 'native'
        ? 'Screen capture did not start. Allow screen sharing when prompted, keep the sharing notification on, and try again.'
        : 'Screen capture did not start. Choose a screen, window, or tab and try again.',
    )
  }

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
        ;(mediaTrack as MediaStreamTrack & { contentHint?: string }).contentHint =
          options?.optimizeForVideo ? 'motion' : 'detail'
      } catch {
        // ignore
      }
    }
    // Wait for a live capture MediaStream. On Android, also require real
    // MediaProjection width/height — faked 720p getSettings() used to pass
    // immediately and publish a black track. iOS ReplayKit never reports size
    // in getSettings (ScreenCaptureController omits width/height), so requiring
    // peekUnpatched dims always failed and tore down a working iPad/iPhone share.
    const expectsCaptureSize = nativeCapturerReportsVideoSize(mediaTrack)
    const started = Date.now()
    while (Date.now() - started < 12_000) {
      if (!isLocalScreenShareTrackReady(publication)) break
      const stream = publication.track.mediaStream
      const live = publication.track.mediaStreamTrack
      if (!stream?.id) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        forceScreenShareTrackSettings(publication.track.mediaStreamTrack)
        continue
      }
      if (!expectsCaptureSize) break
      const actual = peekUnpatchedVideoSize(live)
      if (actual.width > 1 && actual.height > 1) break
      await new Promise((resolve) => setTimeout(resolve, 200))
      forceScreenShareTrackSettings(publication.track.mediaStreamTrack)
    }

    const streamReady = !!publication.track?.mediaStream?.id
    const actual = peekUnpatchedVideoSize(publication.track?.mediaStreamTrack)
    const sizeReady = !expectsCaptureSize || (actual.width > 1 && actual.height > 1)
    if (!isLocalScreenShareTrackReady(publication) || !streamReady || !sizeReady) {
      try {
        await localParticipant.setScreenShareEnabled(false)
      } catch {
        // ignore cleanup failures
      }
      throw new Error(
        expectsCaptureSize
          ? 'Screen share started without video frames. Update SHEconomy to the latest Android build, allow the capture prompt, and keep the sharing notification on.'
          : 'Screen share started without video frames. Choose SHEconomy → Start Broadcast, keep the red status bar visible, and try again.',
      )
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
