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
  /** Track source when available — camera mirrors, screen share never. */
  source?: string | null
  /** Front vs rear camera facing — rear camera must never mirror. */
  cameraFacing?: 'user' | 'environment' | string | null
  /** Active virtual background on this camera. */
  backgroundMode?: 'off' | 'blur' | 'image' | null
}

/**
 * The background picture is composited into the camera frame itself, so a
 * mirrored self-view would show its text and logos reversed.
 */
export function selfViewMirrorAllowed(
  mirrorLocalVideo: boolean | undefined,
  backgroundMode: MeetingVideoMirrorInput['backgroundMode'],
): boolean {
  return mirrorLocalVideo !== false && backgroundMode !== 'image'
}

export function shouldMirrorMeetingVideo(input: MeetingVideoMirrorInput): boolean {
  if (!selfViewMirrorAllowed(input.mirrorLocalVideo, input.backgroundMode)) return false
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
