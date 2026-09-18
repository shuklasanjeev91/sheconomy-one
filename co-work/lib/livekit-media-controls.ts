import type { LocalParticipant, Room } from 'livekit-client'
import type { MeetingVideoEffects } from '~/co-work/lib/meeting-video-effects'
import type { MeetingAudioQuality } from '~/co-work/lib/meeting-audio-quality'

export type LiveKitMediaControls = {
  room: Room
  localParticipant: LocalParticipant
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  videoEffects: MeetingVideoEffects
  audioQuality: MeetingAudioQuality
  /** True when local output is forced to the loudspeaker (vs earpiece / BT). */
  speakerOn: boolean
  toggleAudio: () => void
  toggleVideo: () => void
  toggleScreenShare: () => void | Promise<void>
  toggleSpeaker: () => void | Promise<void>
}

/** `audio` = voice-only publish; `video` / `meeting` enable camera on join. */
export type LiveKitMediaMode = 'meeting' | 'audio' | 'video'

export type LiveKitMeetingRoomProps = {
  meetingId: string
  roomId: string
  displayName: string
  /** Profile image shown on camera-off tiles for this local participant. */
  avatarUrl?: string | null
  isHost: boolean
  enabled: boolean
  mediaMode?: LiveKitMediaMode
  /** Join with microphone published (default true). Pre-join mute sets false. */
  initialAudio?: boolean
  /** Join with camera published when mediaMode allows video (default true). */
  initialVideo?: boolean
  /** Fired once the SFU room is actually connected (not on token fetch). */
  onConnected?: () => void
  onDisconnected: () => void
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
}
