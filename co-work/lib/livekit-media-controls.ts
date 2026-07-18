import type { LocalParticipant, Room } from 'livekit-client'

export type LiveKitMediaControls = {
  room: Room
  localParticipant: LocalParticipant
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
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
  onDisconnected: () => void
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
}
