import { ConnectionQuality, ConnectionState } from 'livekit-client'

export type MeetingConnectionStatus = 'excellent' | 'good' | 'poor' | 'reconnecting'
export type MeetingMicrophonePermission = 'checking' | 'granted' | 'denied' | 'prompt' | 'unavailable'

export type MeetingAudioDevice = {
  id: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

export type MeetingAudioQuality = {
  connectionStatus: MeetingConnectionStatus
  microphonePermission: MeetingMicrophonePermission
  speakerReady: boolean
  inputLevel: number
  microphoneTesting: boolean
  speakerTesting: boolean
  error: string | null
  supportsDeviceSelection: boolean
  inputDevices: MeetingAudioDevice[]
  outputDevices: MeetingAudioDevice[]
  activeInputDeviceId: string | null
  activeOutputDeviceId: string | null
  testMicrophone: () => void
  testSpeaker: () => Promise<void>
  selectInputDevice: (deviceId: string) => Promise<void>
  selectOutputDevice: (deviceId: string) => Promise<void>
  reportError: (cause: unknown) => void
  clearError: () => void
  retryConnection: () => Promise<void>
}

export function deriveMeetingConnectionStatus(
  state: ConnectionState,
  quality: ConnectionQuality,
): MeetingConnectionStatus {
  if (
    state === ConnectionState.Reconnecting ||
    state === ConnectionState.SignalReconnecting ||
    state === ConnectionState.Connecting ||
    state === ConnectionState.Disconnected
  ) {
    return 'reconnecting'
  }
  if (quality === ConnectionQuality.Excellent) return 'excellent'
  if (quality === ConnectionQuality.Good || quality === ConnectionQuality.Unknown) return 'good'
  return 'poor'
}

export function connectionStatusLabel(status: MeetingConnectionStatus): string {
  return status[0].toUpperCase() + status.slice(1)
}
