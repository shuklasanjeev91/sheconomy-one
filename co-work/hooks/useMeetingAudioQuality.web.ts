import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ConnectionQuality,
  ConnectionState,
  RoomEvent,
  type LocalParticipant,
  type Room,
} from 'livekit-client'

import {
  deriveMeetingConnectionStatus,
  type MeetingAudioDevice,
  type MeetingAudioQuality,
  type MeetingMicrophonePermission,
} from '~/co-work/lib/meeting-audio-quality'

function messageForMediaError(error: Error): string {
  if (/NotAllowed|Permission|denied/i.test(error.name + error.message)) {
    return 'Microphone access is blocked. Allow microphone access in your browser settings and try again.'
  }
  if (/NotFound|DevicesNotFound/i.test(error.name + error.message)) {
    return 'No microphone was found. Connect a microphone and try again.'
  }
  return error.message || 'The selected audio device is unavailable.'
}

export function useMeetingAudioQuality(
  room: Room,
  localParticipant: LocalParticipant,
  audioEnabled: boolean,
): MeetingAudioQuality {
  const [connectionStatus, setConnectionStatus] = useState(() =>
    deriveMeetingConnectionStatus(room.state, localParticipant.connectionQuality),
  )
  const [microphonePermission, setMicrophonePermission] =
    useState<MeetingMicrophonePermission>('checking')
  const [speakerReady, setSpeakerReady] = useState(room.canPlaybackAudio)
  const [inputLevel, setInputLevel] = useState(0)
  const [microphoneTesting, setMicrophoneTesting] = useState(false)
  const [speakerTesting, setSpeakerTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputDevices, setInputDevices] = useState<MeetingAudioDevice[]>([])
  const [outputDevices, setOutputDevices] = useState<MeetingAudioDevice[]>([])
  const [activeInputDeviceId, setActiveInputDeviceId] = useState<string | null>(
    room.getActiveDevice('audioinput') ?? null,
  )
  const [activeOutputDeviceId, setActiveOutputDeviceId] = useState<string | null>(
    room.getActiveDevice('audiooutput') ?? null,
  )
  const microphoneTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setInputDevices(
        devices
          .filter((device) => device.kind === 'audioinput')
          .map((device, index) => ({
            id: device.deviceId,
            label: device.label || `Microphone ${index + 1}`,
            kind: 'audioinput' as const,
          })),
      )
      setOutputDevices(
        devices
          .filter((device) => device.kind === 'audiooutput')
          .map((device, index) => ({
            id: device.deviceId,
            label: device.label || `Speaker ${index + 1}`,
            kind: 'audiooutput' as const,
          })),
      )
    } catch (cause) {
      setError(cause instanceof Error ? messageForMediaError(cause) : 'Could not list audio devices.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setMicrophonePermission('unavailable')
        return
      }
      try {
        if (navigator.permissions?.query) {
          const result = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          })
          if (!cancelled) {
            setMicrophonePermission(
              result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'prompt',
            )
          }
        } else if (!cancelled) {
          setMicrophonePermission(audioEnabled ? 'granted' : 'prompt')
        }
      } catch {
        if (!cancelled) setMicrophonePermission(audioEnabled ? 'granted' : 'prompt')
      }
      await refreshDevices()
    })()
    return () => {
      cancelled = true
    }
  }, [audioEnabled, refreshDevices])

  useEffect(() => {
    const syncConnection = () =>
      setConnectionStatus(
        deriveMeetingConnectionStatus(room.state, localParticipant.connectionQuality),
      )
    const onQuality = (_quality: ConnectionQuality, participant: { identity?: string }) => {
      if (participant.identity === localParticipant.identity) syncConnection()
    }
    const onActiveDevice = (kind: MediaDeviceKind, deviceId: string) => {
      if (kind === 'audioinput') setActiveInputDeviceId(deviceId)
      if (kind === 'audiooutput') setActiveOutputDeviceId(deviceId)
    }
    const onMediaError = (cause: Error) => {
      setError(messageForMediaError(cause))
      if (/NotAllowed|Permission|denied/i.test(cause.name + cause.message)) {
        setMicrophonePermission('denied')
      }
    }
    const syncPlayback = () => setSpeakerReady(room.canPlaybackAudio)

    room.on(RoomEvent.ConnectionStateChanged, syncConnection)
    room.on(RoomEvent.ConnectionQualityChanged, onQuality as never)
    room.on(RoomEvent.MediaDevicesChanged, refreshDevices)
    room.on(RoomEvent.ActiveDeviceChanged, onActiveDevice as never)
    room.on(RoomEvent.MediaDevicesError, onMediaError)
    room.on(RoomEvent.AudioPlaybackStatusChanged, syncPlayback)
    syncConnection()
    syncPlayback()

    return () => {
      room.off(RoomEvent.ConnectionStateChanged, syncConnection)
      room.off(RoomEvent.ConnectionQualityChanged, onQuality as never)
      room.off(RoomEvent.MediaDevicesChanged, refreshDevices)
      room.off(RoomEvent.ActiveDeviceChanged, onActiveDevice as never)
      room.off(RoomEvent.MediaDevicesError, onMediaError)
      room.off(RoomEvent.AudioPlaybackStatusChanged, syncPlayback)
    }
  }, [localParticipant, refreshDevices, room])

  useEffect(() => {
    const timer = setInterval(() => {
      const next = audioEnabled ? Math.min(1, Math.max(0, localParticipant.audioLevel || 0)) : 0
      setInputLevel(next)
    }, 120)
    return () => clearInterval(timer)
  }, [audioEnabled, localParticipant])

  useEffect(
    () => () => {
      if (microphoneTestTimerRef.current) clearTimeout(microphoneTestTimerRef.current)
    },
    [],
  )

  const testMicrophone = useCallback(() => {
    if (!audioEnabled) {
      setError('Unmute your microphone before starting the microphone test.')
      return
    }
    setError(null)
    setMicrophoneTesting(true)
    if (microphoneTestTimerRef.current) clearTimeout(microphoneTestTimerRef.current)
    microphoneTestTimerRef.current = setTimeout(() => setMicrophoneTesting(false), 8000)
  }, [audioEnabled])

  const testSpeaker = useCallback(async () => {
    setError(null)
    setSpeakerTesting(true)
    try {
      await room.startAudio()
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) throw new Error('Speaker testing is not supported in this browser.')
      const context = new AudioContextClass()
      const sinkContext = context as AudioContext & { setSinkId?: (id: string) => Promise<void> }
      if (activeOutputDeviceId && sinkContext.setSinkId) {
        await sinkContext.setSinkId(activeOutputDeviceId)
      }
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = 440
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.58)
      await new Promise((resolve) => setTimeout(resolve, 650))
      await context.close()
      setSpeakerReady(true)
    } catch (cause) {
      setSpeakerReady(false)
      setError(cause instanceof Error ? cause.message : 'Could not play the speaker test.')
    } finally {
      setSpeakerTesting(false)
    }
  }, [activeOutputDeviceId, room])

  const selectInputDevice = useCallback(
    async (deviceId: string) => {
      try {
        setError(null)
        await room.switchActiveDevice('audioinput', deviceId)
        setActiveInputDeviceId(deviceId)
        setMicrophonePermission('granted')
      } catch (cause) {
        setError(cause instanceof Error ? messageForMediaError(cause) : 'Could not select microphone.')
      }
    },
    [room],
  )

  const selectOutputDevice = useCallback(
    async (deviceId: string) => {
      try {
        setError(null)
        await room.switchActiveDevice('audiooutput', deviceId)
        setActiveOutputDeviceId(deviceId)
        await room.startAudio()
        setSpeakerReady(true)
      } catch (cause) {
        setError(cause instanceof Error ? messageForMediaError(cause) : 'Could not select speaker.')
      }
    },
    [room],
  )

  const retryConnection = useCallback(async () => {
    setError(null)
    if (!room.canPlaybackAudio) await room.startAudio()
  }, [room])

  return {
    connectionStatus,
    microphonePermission,
    speakerReady,
    inputLevel,
    microphoneTesting,
    speakerTesting,
    error,
    supportsDeviceSelection: !!navigator.mediaDevices?.enumerateDevices,
    inputDevices,
    outputDevices,
    activeInputDeviceId,
    activeOutputDeviceId,
    testMicrophone,
    testSpeaker,
    selectInputDevice,
    selectOutputDevice,
    reportError: (cause) =>
      setError(
        cause instanceof Error ? messageForMediaError(cause) : 'Could not change microphone state.',
      ),
    clearError: () => setError(null),
    retryConnection,
  }
}
