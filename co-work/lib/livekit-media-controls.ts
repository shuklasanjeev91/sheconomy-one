import type { LocalParticipant, Room } from 'livekit-client'

export type LiveKitMediaControls = {
  room: Room
  localParticipant: LocalParticipant
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  toggleAudio: () => void
  toggleVideo: () => void
  toggleScreenShare: () => void | Promise<void>
}

/** `audio` = voice-only publish; `video` / `meeting` enable camera on join. */
export type LiveKitMediaMode = 'meeting' | 'audio' | 'video'

export type LiveKitMeetingRoomProps = {
  meetingId: string
  roomId: string
  displayName: string
  isHost: boolean
  enabled: boolean
  mediaMode?: LiveKitMediaMode
  onDisconnected: () => void
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
}
