/** Simulcast layer index requested for a remote camera (spatial layer on the SFU). */
export const MeetingVideoQuality = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
} as const
export type MeetingVideoQuality = (typeof MeetingVideoQuality)[keyof typeof MeetingVideoQuality]

/**
 * Below this remote count, subscribe every camera. Kept at the smallest gallery
 * page size — every extra subscribed camera is a live decoder, and phones run
 * out of memory decoding a whole room.
 */
export const MEETING_SUBSCRIBE_ALL_BELOW = 6

/** Tile side (layout px) below which the low simulcast layer is enough. */
const CAMERA_LOW_QUALITY_MAX_SIDE = 240
/** Tile side (layout px) below which the medium simulcast layer is enough. */
const CAMERA_MEDIUM_QUALITY_MAX_SIDE = 560

/**
 * Simulcast layer for a remote camera tile. 720p is only worth decoding for
 * large tiles; thumbnails and dense grids take the low / medium layer.
 */
export function meetingCameraQualityForTile(input: {
  width: number
  height: number
  hdVideo?: boolean
}): MeetingVideoQuality {
  const side = Math.max(input.width, input.height)
  if (!(side > 0) || side < CAMERA_LOW_QUALITY_MAX_SIDE) return MeetingVideoQuality.LOW
  if (side < CAMERA_MEDIUM_QUALITY_MAX_SIDE || input.hdVideo === false) {
    return MeetingVideoQuality.MEDIUM
  }
  return MeetingVideoQuality.HIGH
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
