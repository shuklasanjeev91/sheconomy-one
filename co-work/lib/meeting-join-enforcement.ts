import type { MeetingSecuritySettings } from '~/co-work/lib/types'

/**
 * Zoom-style join enforcement: host schedule settings override guest intent.
 * Hosts/co-hosts are not force-muted/video-off by these flags.
 */
export function applyMeetingJoinSecurityMedia(input: {
  audioEnabled: boolean
  videoEnabled: boolean
  security?: MeetingSecuritySettings | null
  isHost?: boolean
  isModerator?: boolean
}): { audioEnabled: boolean; videoEnabled: boolean } {
  if (input.isHost || input.isModerator) {
    return {
      audioEnabled: input.audioEnabled,
      videoEnabled: input.videoEnabled,
    }
  }
  const security = input.security
  return {
    audioEnabled: security?.muteOnJoin ? false : input.audioEnabled,
    videoEnabled: security?.videoOffOnJoin ? false : input.videoEnabled,
  }
}
