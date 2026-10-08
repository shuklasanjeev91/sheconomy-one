export type MeetingVideoSurfaceSize = { w: number; h: number }
export type MeetingVideoFit = 'cover' | 'contain'

/**
 * Android RTCView remounts on every key/size change and often never recovers
 * ("Dropping frame - No surface"). Snap layout noise so the surface stays put.
 */
export function nextMeetingVideoSurfaceSize(
  prev: MeetingVideoSurfaceSize | null,
  next: MeetingVideoSurfaceSize,
  snap = 16,
): MeetingVideoSurfaceSize {
  const width = Math.max(2, Math.round(next.w / snap) * snap)
  const height = Math.max(2, Math.round(next.h / snap) * snap)
  if (prev && Math.abs(prev.w - width) < snap && Math.abs(prev.h - height) < snap) {
    return prev
  }
  return { w: width, h: height }
}

/**
 * Stable remount token — track/stream identity only.
 * Do not include live layout size: speaking borders and pager jitter used to
 * remount Android RTCView and flicker the tile while someone talked.
 */
export function meetingVideoTrackRemountKey(input: {
  trackSid: string | null
  streamId: string | null
  surface: MeetingVideoSurfaceSize
  isScreen: boolean
  mirrored: boolean
}): string {
  return [
    input.trackSid ?? 'track',
    input.streamId ?? 'stream',
    input.isScreen ? 'ss' : 'cam',
    input.mirrored ? 'm' : 'u',
  ].join('-')
}

/**
 * Zoom-style camera fit: normal camera tiles fill the tile, but when the video
 * orientation strongly disagrees with the tile orientation we preserve the full
 * camera frame instead of cropping a portrait feed into a landscape slot.
 */
export function meetingVideoObjectFit(input: {
  isScreen?: boolean
  videoWidth?: number | null
  videoHeight?: number | null
  tileWidth?: number | null
  tileHeight?: number | null
}): MeetingVideoFit {
  if (input.isScreen) return 'contain'
  const videoWidth = Number(input.videoWidth)
  const videoHeight = Number(input.videoHeight)
  const tileWidth = Number(input.tileWidth)
  const tileHeight = Number(input.tileHeight)
  if (
    !Number.isFinite(videoWidth) ||
    !Number.isFinite(videoHeight) ||
    !Number.isFinite(tileWidth) ||
    !Number.isFinite(tileHeight) ||
    videoWidth <= 1 ||
    videoHeight <= 1 ||
    tileWidth <= 1 ||
    tileHeight <= 1
  ) {
    return 'cover'
  }
  const videoAspect = videoWidth / videoHeight
  const tileAspect = tileWidth / tileHeight
  const mismatch = Math.max(videoAspect / tileAspect, tileAspect / videoAspect)
  return mismatch >= 1.35 ? 'contain' : 'cover'
}
