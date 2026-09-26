import {
  LocalTrack,
  ScreenSharePresets,
  Track,
  VideoPresets,
} from 'livekit-client'

let patched = false

const SCREEN_FALLBACK = ScreenSharePresets.h720fps15.resolution
const CAMERA_FALLBACK = VideoPresets.h720.resolution

/**
 * iOS ReplayKit / Android MediaProjection often return empty getSettings()
 * width/height until the first frame arrives. LiveKit's waitForDimensions then
 * throws; LocalParticipant logs console.error ("could not determine track
 * dimensions, using defaults"), and RN LogBox covers the meeting UI even though
 * publish continues with defaults.
 *
 * Fix:
 * 1) Screen-share dimensions resolve immediately to 720p when settings are empty
 *    (so waitForDimensions never times out / throws).
 * 2) waitForDimensions still waits longer for cameras, then falls back quietly.
 */
export function patchLiveKitWaitForDimensions(): void {
  if (patched) return
  patched = true

  const proto = LocalTrack.prototype as LocalTrack & {
    waitForDimensions: (timeout?: number) => Promise<{ width: number; height: number }>
    __sheconomyWaitForDims?: boolean
  }
  if (proto.__sheconomyWaitForDims) return

  const dimsDesc = Object.getOwnPropertyDescriptor(LocalTrack.prototype, 'dimensions')
  if (dimsDesc?.get) {
    Object.defineProperty(LocalTrack.prototype, 'dimensions', {
      configurable: true,
      enumerable: dimsDesc.enumerable ?? false,
      get(this: LocalTrack) {
        const live = dimsDesc.get!.call(this) as Track.Dimensions | undefined
        if (live?.width && live?.height) return live
        // Screen share: never leave dimensions undefined — prevents publish-time
        // timeout + console.error redbox on iOS/Android.
        if (this.source === Track.Source.ScreenShare && this.kind === Track.Kind.Video) {
          return { width: SCREEN_FALLBACK.width, height: SCREEN_FALLBACK.height }
        }
        return live
      },
    })
  }

  const originalFn = proto.waitForDimensions

  proto.waitForDimensions = async function patchedWaitForDimensions(
    timeout?: number,
  ): Promise<{ width: number; height: number }> {
    const isScreen = this.source === Track.Source.ScreenShare
    // Screen share: short wait then guaranteed fallback (dimensions getter already
    // returns 720p, so this usually resolves on the first loop).
    const waitMs = timeout ?? (isScreen ? 2_000 : 3_000)
    try {
      return await originalFn.call(this, waitMs)
    } catch {
      const fallback = isScreen ? SCREEN_FALLBACK : CAMERA_FALLBACK
      return {
        width: fallback.width,
        height: fallback.height,
      }
    }
  }

  proto.__sheconomyWaitForDims = true
}

/**
 * After native getDisplayMedia attaches, force getSettings() to report 720p when
 * the OS still returns 0×0 — LiveKit and RTCView then have real dimensions.
 */
type PatchedMediaStreamTrack = MediaStreamTrack & {
  __sheconomyOriginalGetSettings?: () => MediaTrackSettings
}

function readUnpatchedSettings(
  mediaStreamTrack: MediaStreamTrack,
): MediaTrackSettings {
  const patched = mediaStreamTrack as PatchedMediaStreamTrack
  return (
    (patched.__sheconomyOriginalGetSettings ?? mediaStreamTrack.getSettings)?.call(
      mediaStreamTrack,
    ) ?? {}
  )
}

/** Real capture size — ignores the 720p fallback we inject for LiveKit publish. */
export function peekUnpatchedVideoSize(
  mediaStreamTrack: MediaStreamTrack | null | undefined,
): { width: number; height: number } {
  if (!mediaStreamTrack) return { width: 0, height: 0 }
  try {
    const settings = readUnpatchedSettings(mediaStreamTrack)
    return { width: Number(settings.width) || 0, height: Number(settings.height) || 0 }
  } catch {
    return { width: 0, height: 0 }
  }
}

/**
 * Android MediaProjection reports width/height via AbstractVideoCaptureController.
 * iOS ReplayKit's ScreenCaptureController.getSettings never includes size keys
 * (only deviceId / groupId / frameRate) — and getDisplayMedia often omits settings
 * entirely — so peekUnpatchedVideoSize stays 0×0 even while frames flow.
 */
export function nativeCapturerReportsVideoSize(
  mediaStreamTrack: MediaStreamTrack | null | undefined,
): boolean {
  if (!mediaStreamTrack) return false
  try {
    const settings = readUnpatchedSettings(mediaStreamTrack) as Record<string, unknown>
    return Object.prototype.hasOwnProperty.call(settings, 'width')
      || Object.prototype.hasOwnProperty.call(settings, 'height')
  } catch {
    return false
  }
}

export function forceScreenShareTrackSettings(
  mediaStreamTrack: MediaStreamTrack | null | undefined,
): void {
  if (!mediaStreamTrack || mediaStreamTrack.kind !== 'video') return
  try {
    const patched = mediaStreamTrack as PatchedMediaStreamTrack
    if (!patched.__sheconomyOriginalGetSettings) {
      patched.__sheconomyOriginalGetSettings = mediaStreamTrack.getSettings.bind(mediaStreamTrack)
    }
    const original = patched.__sheconomyOriginalGetSettings
    const settings = original()
    const width = Number(settings.width) || 0
    const height = Number(settings.height) || 0
    if (width > 1 && height > 1) return

    mediaStreamTrack.getSettings = () => {
      const live = original()
      const w = Number(live.width) || 0
      const h = Number(live.height) || 0
      if (w > 1 && h > 1) return live
      return {
        ...live,
        width: SCREEN_FALLBACK.width,
        height: SCREEN_FALLBACK.height,
        frameRate: live.frameRate || 15,
      }
    }
  } catch {
    // Soft-fail — some native tracks reject getSettings reassignment.
  }
}
