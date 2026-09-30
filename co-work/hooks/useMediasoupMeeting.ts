import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { BuiltinHandlerName } from 'mediasoup-client/types'

import { resolveCallAudioCapture } from '~/co-work/lib/call-audio-options'
import type {
  CameraFacing,
  MeetingDisconnectReason,
  MeetingMediaControls,
  MeetingMediaMode,
  MeetingMicrophoneCapture,
} from '~/co-work/lib/meeting-media-controls'
import {
  isScreenShareCancellation,
  type ScreenShareStartOptions,
} from '~/co-work/lib/meeting-screen-share'
import {
  MEETING_RECONNECT_BANNER_DEBOUNCE_MS,
  type MeetingAudioDevice,
  type MeetingAudioQuality,
  type MeetingConnectionStatus,
} from '~/co-work/lib/meeting-audio-quality'
import type { MeetingVideoEffects } from '~/co-work/lib/meeting-video-effects'
import { selfViewMirrorAllowed } from '~/co-work/lib/meeting-video-mirror'
import type { MediasoupCredentials } from '~/co-work/lib/mediasoup/mediasoup-credentials'
import {
  MediasoupRoom,
  type MediasoupConnectionState,
  type MediasoupRoomSnapshot,
} from '~/co-work/lib/mediasoup/mediasoup-room'
import {
  mediasoupActiveSpeakerIdentity,
  mediasoupFeaturedVideo,
  mediasoupScreenShareIdentity,
  mediasoupSpeakingIdentities,
  mediasoupStageTrackRefs,
  type MediasoupTrackRef,
} from '~/co-work/lib/mediasoup/mediasoup-stage-tracks'
import { mediasoupPeerUserId } from '~/co-work/lib/mediasoup/peer-identity'
import { setMeetingCameraIntent } from '~/co-work/lib/meeting-camera-intent'

export type MediasoupMediaErrorKind = 'microphone' | 'camera' | 'screen_share' | 'speaker'

export type MediasoupVideoEffectsInput = {
  room: MediasoupRoom | null
  cameraEnabled: boolean
  /** Captured camera before any processing. */
  cameraTrack: MediaStreamTrack | null
}

/** What differs between the browser and the React Native builds. */
export type MediasoupMeetingPlatform = {
  native: boolean
  handlerName?: BuiltinHandlerName
  /** Runs once before the room is created (WebRTC globals on native). */
  prepare?: () => void
  errorMessage: (kind: MediasoupMediaErrorKind, cause: unknown) => string
  /** Resolve to an error message when the microphone may not be used. */
  beforeMicEnable?: () => Promise<string | null>
  /** Throw to cancel (unsupported build, picker dismissed). */
  beforeScreenShare?: () => Promise<void>
  screenShareConstraints?: (options?: ScreenShareStartOptions | null) => DisplayMediaStreamOptions
  /** Resolves to whether the loudspeaker is now the output. */
  setSpeaker?: (speakerOn: boolean) => Promise<boolean>
  initialSpeakerOn: boolean
  /** Virtual backgrounds; a hook, so it must be the same function for the life of the room. */
  useVideoEffects?: (input: MediasoupVideoEffectsInput) => MeetingVideoEffects
  /** Browser device pickers; omitted on native. */
  devices?: {
    enumerate: () => Promise<MediaDeviceInfo[]>
    playTestTone?: (outputDeviceId: string | null) => Promise<void>
  }
}

const UNAVAILABLE_VIDEO_EFFECTS: MeetingVideoEffects = {
  capability: 'unavailable',
  status: 'idle',
  selection: { mode: 'off' },
  error: null,
  apply: async () => false,
  retry: async () => false,
}

function useUnavailableVideoEffects(_input: MediasoupVideoEffectsInput): MeetingVideoEffects {
  return UNAVAILABLE_VIDEO_EFFECTS
}

const MIC_LEVEL_POLL_MS = 150

const EMPTY_SNAPSHOT: MediasoupRoomSnapshot = {
  connection: 'connecting',
  error: null,
  removed: false,
  peers: [],
  local: {
    micEnabled: false,
    micTrack: null,
    cameraEnabled: false,
    cameraTrack: null,
    cameraRawTrack: null,
    cameraFacing: 'user',
    screenSharing: false,
    screenTrack: null,
  },
  activeSpeakerPeerId: null,
  speakingPeerIds: [],
}

const noopSubscribe = () => () => {}
const emptySnapshot = () => EMPTY_SNAPSHOT

export function mediasoupConnectionStatus(connection: MediasoupConnectionState): MeetingConnectionStatus {
  if (connection === 'reconnecting') return 'reconnecting'
  if (connection === 'failed' || connection === 'closed') return 'poor'
  return 'good'
}

function mapDevices(devices: MediaDeviceInfo[], kind: MeetingAudioDevice['kind'], label: string) {
  return devices
    .filter((device) => device.kind === kind)
    .map((device, index) => ({
      id: device.deviceId,
      label: device.label || `${label} ${index + 1}`,
      kind,
    }))
}

export type MediasoupMeeting = {
  room: MediasoupRoom | null
  snapshot: MediasoupRoomSnapshot
  media: MeetingMediaControls | null
  trackRefs: MediasoupTrackRef[]
  localUserId: string
  activeSpeakerIdentity: string | null
  /** Browser output device for remote audio elements. */
  outputDeviceId: string | null
}

export function useMediasoupMeeting(input: {
  credentials: MediasoupCredentials
  displayName: string
  avatarUrl?: string | null
  mediaMode: MeetingMediaMode
  initialAudio: boolean
  initialVideo: boolean
  onConnected?: () => void
  onDisconnected: (reason?: MeetingDisconnectReason) => void
  platform: MediasoupMeetingPlatform
}): MediasoupMeeting {
  const { credentials, displayName, avatarUrl, mediaMode, platform } = input
  const [room, setRoom] = useState<MediasoupRoom | null>(null)
  const localUserId = mediasoupPeerUserId(credentials.peerId)

  const callbacksRef = useRef({ onConnected: input.onConnected, onDisconnected: input.onDisconnected })
  callbacksRef.current = { onConnected: input.onConnected, onDisconnected: input.onDisconnected }
  const initialRef = useRef({ audio: input.initialAudio, video: input.initialVideo })
  const platformRef = useRef(platform)
  platformRef.current = platform

  useEffect(() => {
    platformRef.current.prepare?.()
    const next = new MediasoupRoom({
      url: credentials.url,
      roomId: credentials.roomId,
      peerId: credentials.peerId,
      token: credentials.token,
      displayName,
      avatarUrl,
      handlerName: platformRef.current.handlerName,
      mediaDevices: () => navigator.mediaDevices,
      simulcast: mediaMode !== 'audio',
    })
    setRoom(next)
    let cancelled = false
    const video = mediaMode !== 'audio' && initialRef.current.video
    // Set before the lifecycle hook's first effect reads it; a previous meeting's intent must not leak in.
    setMeetingCameraIntent(video)
    void (async () => {
      const audioConstraints = await resolveCallAudioCapture().catch(() => undefined)
      if (cancelled) return
      await next.join({
        audio: initialRef.current.audio,
        video,
        audioConstraints,
      })
    })()
    return () => {
      cancelled = true
      setMeetingCameraIntent(false)
      next.close()
    }
    // Display name / avatar changes do not warrant rejoining.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials.peerId, credentials.roomId, credentials.token, credentials.url, mediaMode])

  useEffect(() => {
    void room?.setDisplayName(displayName)
  }, [displayName, room])

  const snapshot = useSyncExternalStore(
    room?.subscribe ?? noopSubscribe,
    room?.getSnapshot ?? emptySnapshot,
    room?.getSnapshot ?? emptySnapshot,
  )

  const connectedOnceRef = useRef(false)
  useEffect(() => {
    if (snapshot.connection === 'connected' && !connectedOnceRef.current) {
      connectedOnceRef.current = true
      callbacksRef.current.onConnected?.()
    }
    if (snapshot.removed) {
      callbacksRef.current.onDisconnected('removed')
    } else if (snapshot.connection === 'failed') {
      callbacksRef.current.onDisconnected('unknown')
    }
  }, [snapshot.connection, snapshot.removed])

  // ── audio quality (errors, connection banner, browser devices) ──────────
  const [error, setError] = useState<string | null>(null)
  const reportError = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : String(cause ?? 'Something went wrong.'))
  }, [])
  const clearError = useCallback(() => setError(null), [])
  useEffect(() => {
    if (snapshot.error) setError(snapshot.error)
  }, [snapshot.error])

  const [connectionStatus, setConnectionStatus] = useState<MeetingConnectionStatus>('good')
  useEffect(() => {
    const next = mediasoupConnectionStatus(snapshot.connection)
    if (next !== 'reconnecting') {
      setConnectionStatus(next)
      return
    }
    const timer = setTimeout(() => setConnectionStatus('reconnecting'), MEETING_RECONNECT_BANNER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [snapshot.connection])

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [activeInputDeviceId, setActiveInputDeviceId] = useState<string | null>(null)
  const [activeOutputDeviceId, setActiveOutputDeviceId] = useState<string | null>(null)
  const [activeVideoDeviceId, setActiveVideoDeviceId] = useState<string | null>(null)
  const [microphoneTesting, setMicrophoneTesting] = useState(false)
  const [speakerTesting, setSpeakerTesting] = useState(false)
  const deviceApi = platform.devices

  useEffect(() => {
    if (!deviceApi) return
    let cancelled = false
    const refresh = () => {
      void deviceApi
        .enumerate()
        .then((list) => {
          if (!cancelled) setDevices(list)
        })
        .catch(() => {})
    }
    refresh()
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh)
    return () => {
      cancelled = true
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh)
    }
  }, [deviceApi, snapshot.local.micEnabled, snapshot.local.cameraEnabled])

  const selectInputDevice = useCallback(
    async (deviceId: string) => {
      if (!room) return
      setActiveInputDeviceId(deviceId)
      try {
        const capture = await resolveCallAudioCapture()
        await room.restartMic({ ...capture, deviceId: { exact: deviceId } })
      } catch (cause) {
        reportError(platformRef.current.errorMessage('microphone', cause))
      }
    },
    [reportError, room],
  )

  const selectVideoDevice = useCallback(
    async (deviceId: string) => {
      if (!room) return
      setActiveVideoDeviceId(deviceId)
      if (!room.getSnapshot().local.cameraEnabled) return
      try {
        await room.setCameraEnabled(true, { deviceId })
      } catch (cause) {
        reportError(platformRef.current.errorMessage('camera', cause))
      }
    },
    [reportError, room],
  )

  const selectOutputDevice = useCallback(async (deviceId: string) => {
    setActiveOutputDeviceId(deviceId)
  }, [])

  const testMicrophone = useCallback(() => {
    setMicrophoneTesting(true)
    setTimeout(() => setMicrophoneTesting(false), 3_000)
  }, [])

  const testSpeaker = useCallback(async () => {
    const play = deviceApi?.playTestTone
    if (!play) return
    setSpeakerTesting(true)
    try {
      await play(activeOutputDeviceId)
    } finally {
      setSpeakerTesting(false)
    }
  }, [activeOutputDeviceId, deviceApi])

  const [inputLevel, setInputLevel] = useState(0)
  const micOn = snapshot.local.micEnabled
  useEffect(() => {
    if (!room || !micOn) {
      setInputLevel(0)
      return
    }
    let cancelled = false
    const timer = setInterval(() => {
      void room.getMicLevel().then((level) => {
        if (!cancelled) setInputLevel((prev) => (Math.abs(prev - level) < 0.01 ? prev : level))
      })
    }, MIC_LEVEL_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [micOn, room])

  const retryConnection = useCallback(async () => {
    await room?.reconnect()
  }, [room])

  const audioQuality = useMemo<MeetingAudioQuality>(
    () => ({
      connectionStatus,
      microphonePermission: snapshot.local.micEnabled ? 'granted' : 'prompt',
      speakerReady: true,
      inputLevel,
      microphoneTesting,
      speakerTesting,
      error,
      supportsDeviceSelection: !!deviceApi,
      inputDevices: mapDevices(devices, 'audioinput', 'Microphone'),
      outputDevices: mapDevices(devices, 'audiooutput', 'Speaker'),
      videoDevices: mapDevices(devices, 'videoinput', 'Camera'),
      activeInputDeviceId,
      activeOutputDeviceId,
      activeVideoDeviceId,
      testMicrophone,
      testSpeaker,
      selectInputDevice,
      selectOutputDevice,
      selectVideoDevice,
      reportError,
      clearError,
      retryConnection,
    }),
    [
      activeInputDeviceId,
      activeOutputDeviceId,
      activeVideoDeviceId,
      clearError,
      connectionStatus,
      deviceApi,
      devices,
      error,
      inputLevel,
      microphoneTesting,
      reportError,
      retryConnection,
      selectInputDevice,
      selectOutputDevice,
      selectVideoDevice,
      snapshot.local.micEnabled,
      speakerTesting,
      testMicrophone,
      testSpeaker,
    ],
  )

  // ── toggles ──────────────────────────────────────────────────────────────
  const [speakerOn, setSpeakerOn] = useState(platform.initialSpeakerOn)
  const micBusyRef = useRef(false)
  const cameraBusyRef = useRef(false)
  const screenBusyRef = useRef(false)
  const flipBusyRef = useRef(false)

  const toggleAudio = useCallback(() => {
    if (!room || micBusyRef.current) return
    const next = !room.getSnapshot().local.micEnabled
    micBusyRef.current = true
    clearError()
    void (async () => {
      try {
        if (next) {
          const denied = await platformRef.current.beforeMicEnable?.()
          if (denied) {
            reportError(denied)
            return
          }
        }
        const capture = next ? await resolveCallAudioCapture().catch(() => undefined) : undefined
        await room.setMicEnabled(next, capture)
      } catch (cause) {
        reportError(platformRef.current.errorMessage('microphone', cause))
      } finally {
        micBusyRef.current = false
      }
    })()
  }, [clearError, reportError, room])

  const toggleVideo = useCallback(() => {
    if (!room || cameraBusyRef.current) return
    const local = room.getSnapshot().local
    const next = !local.cameraEnabled
    cameraBusyRef.current = true
    setMeetingCameraIntent(next)
    clearError()
    void room
      .setCameraEnabled(next, {
        facingMode: local.cameraFacing,
        ...(next && activeVideoDeviceId ? { deviceId: activeVideoDeviceId } : {}),
      })
      .catch((cause) => reportError(platformRef.current.errorMessage('camera', cause)))
      .finally(() => {
        cameraBusyRef.current = false
      })
  }, [activeVideoDeviceId, clearError, reportError, room])

  const flipCamera = useCallback(async (): Promise<CameraFacing> => {
    if (!room) return 'user'
    if (flipBusyRef.current) return room.getSnapshot().local.cameraFacing
    flipBusyRef.current = true
    clearError()
    try {
      return await room.flipCamera(platformRef.current.native)
    } catch (cause) {
      const message = platformRef.current.errorMessage('camera', cause)
      reportError(message)
      throw new Error(message)
    } finally {
      flipBusyRef.current = false
    }
  }, [clearError, reportError, room])

  const toggleScreenShare = useCallback(
    async (options?: ScreenShareStartOptions | null): Promise<boolean> => {
      if (!room || screenBusyRef.current) return false
      const enabling = !room.getSnapshot().local.screenSharing
      screenBusyRef.current = true
      try {
        if (enabling) await platformRef.current.beforeScreenShare?.()
        await room.setScreenShareEnabled(enabling, {
          audio: !!options?.shareComputerSound,
          contentHint: options?.optimizeForVideo ? 'motion' : 'detail',
          constraints: enabling ? platformRef.current.screenShareConstraints?.(options) : undefined,
        })
      } catch (cause) {
        if (enabling && isScreenShareCancellation(cause)) return false
        throw new Error(platformRef.current.errorMessage('screen_share', cause))
      } finally {
        screenBusyRef.current = false
      }
      return true
    },
    [room],
  )

  // Dev helper (`/co-work/dev/auto-share`): start sharing once, right after joining.
  useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__ || snapshot.connection !== 'connected') return
    const flags = globalThis as { __AUTO_SCREEN_SHARE?: boolean }
    if (!flags.__AUTO_SCREEN_SHARE) return
    delete flags.__AUTO_SCREEN_SHARE
    void toggleScreenShare().catch(() => {})
  }, [snapshot.connection, toggleScreenShare])

  const toggleSpeaker = useCallback(async () => {
    const setSpeaker = platformRef.current.setSpeaker
    if (!setSpeaker) return
    try {
      setSpeakerOn(await setSpeaker(!speakerOn))
    } catch (cause) {
      reportError(platformRef.current.errorMessage('speaker', cause))
    }
  }, [reportError, speakerOn])

  const disconnect = useCallback(() => {
    room?.close()
  }, [room])

  const restartMicrophone = useCallback(
    async (capture: MeetingMicrophoneCapture) => {
      if (!room) return
      const deviceId = activeInputDeviceId ? { deviceId: { exact: activeInputDeviceId } } : {}
      await room.restartMic({ ...capture, ...deviceId })
    },
    [activeInputDeviceId, room],
  )

  const useVideoEffects = platform.useVideoEffects ?? useUnavailableVideoEffects
  const videoEffects = useVideoEffects({
    room,
    cameraEnabled: snapshot.local.cameraEnabled,
    cameraTrack: snapshot.local.cameraRawTrack,
  })

  const featuredMirrorAllowed = selfViewMirrorAllowed(true, videoEffects.selection.mode)
  const featuredRef = useRef<ReturnType<typeof mediasoupFeaturedVideo>>(null)
  const featuredVideo = useMemo(() => {
    const next = mediasoupFeaturedVideo(snapshot, featuredMirrorAllowed)
    const previous = featuredRef.current
    // Same track: keep identity so the global mini-player store is not re-emitted.
    if (previous && next && previous.track === next.track && previous.mirrored === next.mirrored) {
      return previous
    }
    featuredRef.current = next
    return next
  }, [featuredMirrorAllowed, snapshot])

  const speakingIdentities = useMemo(
    () => mediasoupSpeakingIdentities(snapshot, { peerId: credentials.peerId, userId: localUserId }),
    [credentials.peerId, localUserId, snapshot],
  )

  const activeSpeakerIdentity = useMemo(
    () => mediasoupActiveSpeakerIdentity(snapshot, { peerId: credentials.peerId, userId: localUserId }),
    [credentials.peerId, localUserId, snapshot],
  )

  const screenShareIdentity = mediasoupScreenShareIdentity(snapshot)

  const media = useMemo<MeetingMediaControls | null>(() => {
    if (!room) return null
    return {
      backend: 'mediasoup',
      connected: snapshot.connection === 'connected',
      audioEnabled: snapshot.local.micEnabled,
      videoEnabled: snapshot.local.cameraEnabled,
      screenSharing: snapshot.local.screenSharing,
      screenShareIdentity,
      videoEffects,
      audioQuality,
      speakerOn,
      cameraFacing: snapshot.local.cameraFacing,
      speakingIdentities,
      activeSpeakerIdentity,
      toggleAudio,
      toggleVideo,
      toggleScreenShare,
      toggleSpeaker,
      flipCamera,
      restartMicrophone,
      featuredVideo,
      disconnect,
    }
  }, [
    activeSpeakerIdentity,
    audioQuality,
    disconnect,
    featuredVideo,
    flipCamera,
    restartMicrophone,
    room,
    screenShareIdentity,
    snapshot.connection,
    snapshot.local.cameraEnabled,
    snapshot.local.cameraFacing,
    snapshot.local.micEnabled,
    snapshot.local.screenSharing,
    speakerOn,
    speakingIdentities,
    toggleAudio,
    toggleScreenShare,
    toggleSpeaker,
    toggleVideo,
    videoEffects,
  ])

  const trackRefs = useMemo(
    () =>
      mediasoupStageTrackRefs(snapshot, {
        peerId: credentials.peerId,
        userId: localUserId,
        displayName,
        avatarUrl: avatarUrl ?? null,
      }),
    [avatarUrl, credentials.peerId, displayName, localUserId, snapshot],
  )

  return {
    room,
    snapshot,
    media,
    trackRefs,
    localUserId,
    activeSpeakerIdentity,
    outputDeviceId: activeOutputDeviceId,
  }
}
