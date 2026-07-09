import type { MediaCapabilities } from '../types'

export function getMediaCapabilities(): MediaCapabilities {
  return {
    platform: 'native',
    supportsVideo: false,
    supportsScreenShare: false,
    supportsRecording: false,
  }
}

export type WebMediaSession = never

export type MediaSessionCallbacks = {
  onRemoteStream: (peerId: string, stream: MediaStream) => void
  onRemoteScreenStream: (peerId: string, stream: MediaStream | null) => void
  onPeerDisconnected: (peerId: string) => void
}

export function createMediaSession(): null {
  return null
}

export const NATIVE_MEETING_NOTICE =
  'HD video and screen sharing work best on web. Chat and participant controls are available on mobile.'
