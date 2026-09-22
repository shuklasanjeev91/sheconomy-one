export type MeetingVideoSurfaceSize = { w: number; h: number }

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
