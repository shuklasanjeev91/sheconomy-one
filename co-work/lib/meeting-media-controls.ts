import type { MeetingVideoEffects } from '~/co-work/lib/meeting-video-effects'
import type { MeetingAudioQuality } from '~/co-work/lib/meeting-audio-quality'
import type { ScreenShareStartOptions } from '~/co-work/lib/meeting-screen-share'
import type { SessionVideoTrack } from '~/lib/session/global-session'

export type CameraFacing = 'user' | 'environment'

/** SFU that carries a meeting's audio and video. */
export type MeetingMediaBackend = 'mediasoup'

/** Why the media room closed on its own (not a local leave). */
export type MeetingDisconnectReason = 'removed' | 'duplicate_identity' | 'unknown'

/** Media controls the meeting UI drives, independent of the SFU. */
export type MeetingMediaControls = {
  backend: MeetingMediaBackend
  /** SFU transports are up (false while joining or reconnecting). */
  connected: boolean
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  /** User id of someone else presenting their screen, if anyone is. */
  screenShareIdentity: string | null
  videoEffects: MeetingVideoEffects
  audioQuality: MeetingAudioQuality
  /** True when local output is forced to the loudspeaker (vs earpiece / BT). */
  speakerOn: boolean
  /** Front (`user`) vs rear (`environment`) camera facing. */
  cameraFacing: CameraFacing
  /** User ids currently speaking. */
  speakingIdentities: string[]
  /** Loudest current speaker, if any. */
  activeSpeakerIdentity: string | null
  /** User ids of remote participants connected to the media server. */
  remoteUserIds: string[]
  toggleAudio: () => void
  toggleVideo: () => void
  /** Resolves false when nothing changed (picker cancelled, busy, not connected). */
  toggleScreenShare: (options?: ScreenShareStartOptions | null) => void | Promise<boolean | void>
  toggleSpeaker: () => void | Promise<void>
  /** Flip between front and rear cameras (enables camera if needed). Returns the new facing. */
  flipCamera: () => CameraFacing | Promise<CameraFacing>
  /** Re-acquire the microphone with new capture constraints (Original Sound). */
  restartMicrophone: (capture: MeetingMicrophoneCapture) => Promise<void>
  /** Video for the mini-player: remote screen, active speaker, any camera, then self. */
  featuredVideo: SessionVideoTrack | null
  /** Leave the media room (stops local capture). */
  disconnect: () => void
}

export type MeetingMicrophoneCapture = {
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
}

/** `audio` = voice-only publish; `video` / `meeting` enable camera on join. */
export type MeetingMediaMode = 'meeting' | 'audio' | 'video'

export type MeetingRoomProps = {
  meetingId: string
  roomId: string
  displayName: string
  /** Profile image shown on camera-off tiles for this local participant. */
  avatarUrl?: string | null
  isHost: boolean
  enabled: boolean
  mediaMode?: MeetingMediaMode
  /** Join with microphone published (default true). Pre-join mute sets false. */
  initialAudio?: boolean
  /** Join with camera published when mediaMode allows video (default true). */
  initialVideo?: boolean
  /** Fired once the SFU room is actually connected (not on token fetch). */
  onConnected?: () => void
  onDisconnected: (reason?: MeetingDisconnectReason) => void
  overlay?: (media: MeetingMediaControls | null) => React.ReactNode
}
