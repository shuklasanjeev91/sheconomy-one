import {
  LocalTrack,
  ScreenSharePresets,
  Track,
  VideoPresets,
} from 'livekit-client'

let patched = false

/**
 * iOS ReplayKit / Android MediaProjection often return empty getSettings()
 * width/height until the first frame arrives. LiveKit's default 1s
 * waitForDimensions then throws, LocalParticipant logs console.error
 * ("could not determine track dimensions, using defaults"), and RN LogBox
 * covers the meeting UI even though publish continues with defaults.
 *
 * Wait longer for screen share, and fall back quietly to the same 720p
 * defaults LiveKit would have used — without the red error overlay.
 */
export function patchLiveKitWaitForDimensions(): void {
  if (patched) return
  patched = true

  const proto = LocalTrack.prototype as LocalTrack & {
    waitForDimensions: (timeout?: number) => Promise<{ width: number; height: number }>
    __sheconomyWaitForDims?: boolean
  }
  if (proto.__sheconomyWaitForDims) return

  const originalFn = proto.waitForDimensions

  proto.waitForDimensions = async function patchedWaitForDimensions(
    timeout?: number,
  ): Promise<{ width: number; height: number }> {
    const isScreen = this.source === Track.Source.ScreenShare
    const waitMs = timeout ?? (isScreen ? 8_000 : 3_000)
    try {
      return await originalFn.call(this, waitMs)
    } catch {
      const fallback = isScreen
        ? ScreenSharePresets.h720fps15.resolution
        : VideoPresets.h720.resolution
      return {
        width: fallback.width,
        height: fallback.height,
      }
    }
  }

  proto.__sheconomyWaitForDims = true
}
