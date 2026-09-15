import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ConnectionQuality,
  RoomEvent,
  type LocalParticipant,
  type Room,
} from 'livekit-client'

import {
  deriveMeetingConnectionStatus,
  type MeetingAudioQuality,
  type MeetingMicrophonePermission,
} from '~/co-work/lib/meeting-audio-quality'

function createSpeakerTestWaveBase64(): string {
  const sampleRate = 8000
  const sampleCount = Math.floor(sampleRate * 0.55)
  const bytes = new Uint8Array(44 + sampleCount * 2)
  const view = new DataView(bytes.buffer)
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }
  write(0, 'RIFF')
  view.setUint32(4, bytes.length - 8, true)
  write(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, sampleCount * 2, true)
  for (let index = 0; index < sampleCount; index += 1) {
    const fade = Math.min(1, index / 240, (sampleCount - index) / 400)
    const sample = Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.22 * fade
    view.setInt16(44 + index * 2, sample * 32767, true)
  }
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0)
  }
  return btoa(binary)
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
  const [inputLevel, setInputLevel] = useState(0)
  const [microphoneTesting, setMicrophoneTesting] = useState(false)
  const [speakerTesting, setSpeakerTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const microphoneTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { Camera } = await import('expo-camera')
        const permission = await Camera.getMicrophonePermissionsAsync()
        if (!cancelled) {
          setMicrophonePermission(
            permission.granted ? 'granted' : permission.canAskAgain ? 'prompt' : 'denied',
          )
        }
      } catch {
        if (!cancelled) setMicrophonePermission(audioEnabled ? 'granted' : 'unavailable')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [audioEnabled])

  useEffect(() => {
    const syncConnection = () =>
      setConnectionStatus(
        deriveMeetingConnectionStatus(room.state, localParticipant.connectionQuality),
      )
    const onQuality = (_quality: ConnectionQuality, participant: { identity?: string }) => {
      if (participant.identity === localParticipant.identity) syncConnection()
    }
    const onMediaError = (cause: Error) => {
      const denied = /NotAllowed|Permission|denied/i.test(cause.name + cause.message)
      if (denied) setMicrophonePermission('denied')
      setError(
        denied
          ? 'Microphone access is blocked. Enable it in Settings → SHEconomy and try again.'
          : cause.message || 'The microphone is unavailable.',
      )
    }
    room.on(RoomEvent.ConnectionStateChanged, syncConnection)
    room.on(RoomEvent.ConnectionQualityChanged, onQuality as never)
    room.on(RoomEvent.MediaDevicesError, onMediaError)
    syncConnection()
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, syncConnection)
      room.off(RoomEvent.ConnectionQualityChanged, onQuality as never)
      room.off(RoomEvent.MediaDevicesError, onMediaError)
    }
  }, [localParticipant, room])

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
    let player: { play: () => void; remove: () => void } | null = null
    try {
      const [FileSystem, Audio] = await Promise.all([
        import('expo-file-system/legacy'),
        import('expo-audio'),
      ])
      if (!FileSystem.cacheDirectory) throw new Error('Speaker testing is unavailable.')
      const uri = `${FileSystem.cacheDirectory}sheconomy-speaker-test.wav`
      await FileSystem.writeAsStringAsync(uri, createSpeakerTestWaveBase64(), {
        encoding: FileSystem.EncodingType.Base64,
      })
      player = Audio.createAudioPlayer({ uri })
      player.play()
      await new Promise((resolve) => setTimeout(resolve, 800))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not play the speaker test.')
    } finally {
      try {
        player?.remove()
      } catch {
        // Best-effort cleanup.
      }
      setSpeakerTesting(false)
    }
  }, [])

  return {
    connectionStatus,
    microphonePermission,
    speakerReady: true,
    inputLevel,
    microphoneTesting,
    speakerTesting,
    error,
    supportsDeviceSelection: false,
    inputDevices: [],
    outputDevices: [],
    activeInputDeviceId: null,
    activeOutputDeviceId: null,
    testMicrophone,
    testSpeaker,
    selectInputDevice: async () => {},
    selectOutputDevice: async () => {},
    reportError: (cause) =>
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not change microphone state. Check microphone permission and try again.',
      ),
    clearError: () => setError(null),
    retryConnection: async () => {},
  }
}
