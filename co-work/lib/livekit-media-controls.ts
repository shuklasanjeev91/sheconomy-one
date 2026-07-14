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

export type LiveKitMeetingRoomProps = {
  meetingId: string
  roomId: string
  displayName: string
  isHost: boolean
  enabled: boolean
  onDisconnected: () => void
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
}
