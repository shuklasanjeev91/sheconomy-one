export type MeetingConnectionStatus = 'excellent' | 'good' | 'poor' | 'reconnecting'
export type MeetingMicrophonePermission = 'checking' | 'granted' | 'denied' | 'prompt' | 'unavailable'

export type MeetingAudioDevice = {
  id: string
  label: string
  kind: 'audioinput' | 'audiooutput' | 'videoinput'
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
  videoDevices: MeetingAudioDevice[]
  activeInputDeviceId: string | null
  activeOutputDeviceId: string | null
  activeVideoDeviceId: string | null
  testMicrophone: () => void
  testSpeaker: () => Promise<void>
  selectInputDevice: (deviceId: string) => Promise<void>
  selectOutputDevice: (deviceId: string) => Promise<void>
  selectVideoDevice: (deviceId: string) => Promise<void>
  reportError: (cause: unknown) => void
  clearError: () => void
  retryConnection: () => Promise<void>
}

/** How long an SFU reconnect must last before we surface the interrupt banner. */
export const MEETING_RECONNECT_BANNER_DEBOUNCE_MS = 1_500

export function connectionStatusLabel(status: MeetingConnectionStatus): string {
  return status[0].toUpperCase() + status.slice(1)
}
