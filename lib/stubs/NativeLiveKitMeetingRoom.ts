import type { LiveKitMediaControls } from '~/co-work/components/LiveKitMeetingRoom'

type NativeLiveKitMeetingRoomProps = {
  meetingId: string
  roomId: string
  displayName: string
  isHost: boolean
  enabled: boolean
  onDisconnected: () => void
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
}

export function NativeLiveKitMeetingRoom(_props: NativeLiveKitMeetingRoomProps) {
  return null
}
