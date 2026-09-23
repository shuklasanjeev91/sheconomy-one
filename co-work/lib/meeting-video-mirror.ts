/**
 * Meeting video mirroring policy.
 *
 * Only the local camera self-view is mirrored (selfie-style). Remote cameras
 * and any screen share always render unmirrored so text and left/right match
 * what other people see / what the sharer intends.
 */

export type MeetingVideoMirrorInput = {
  /** Prefer `mirrorLocalVideo` preference; defaults to ON. */
  mirrorLocalVideo?: boolean
  isLocal: boolean
  isScreenShare?: boolean
  /** LiveKit source when available — Camera mirrors, ScreenShare never. */
  source?: string | null
  /** Front vs rear camera facing — rear camera must never mirror. */
  cameraFacing?: 'user' | 'environment' | string | null
}

export function shouldMirrorMeetingVideo(input: MeetingVideoMirrorInput): boolean {
  const preferenceOn = input.mirrorLocalVideo !== false
  if (!preferenceOn) return false
  if (!input.isLocal) return false
  if (input.isScreenShare) return false
  if (input.source && /screen/i.test(input.source)) return false
  if (input.cameraFacing === 'environment') return false
  return true
}

/** CSS / style transform used on web HTML video elements. */
export function meetingVideoMirrorTransform(mirrored: boolean): string | undefined {
  return mirrored ? 'scaleX(-1)' : undefined
}
