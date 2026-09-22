import type { LocalParticipant, Room } from 'livekit-client'
import type { MeetingVideoEffects } from '~/co-work/lib/meeting-video-effects'
import type { MeetingAudioQuality } from '~/co-work/lib/meeting-audio-quality'
import type { ScreenShareStartOptions } from '~/co-work/lib/livekit-screen-share'

export type CameraFacing = 'user' | 'environment'

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
  /** Front (`user`) vs rear (`environment`) camera facing. */
  cameraFacing: CameraFacing
  toggleAudio: () => void
  toggleVideo: () => void
  toggleScreenShare: (options?: ScreenShareStartOptions | null) => void | Promise<void>
  toggleSpeaker: () => void | Promise<void>
  /** Flip between front and rear cameras (enables camera if needed). Returns the new facing. */
  flipCamera: () => CameraFacing | Promise<CameraFacing>
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
