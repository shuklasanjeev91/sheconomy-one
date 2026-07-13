import { isNativeRuntime } from '~/lib/platform/capabilities'
import type { RecordedAudio } from '~/lib/media/audio-recorder'

export type { RecordedAudio }

let recorder: {
  prepareToRecordAsync: () => Promise<void>
  record: () => void
  stop: () => Promise<void>
  uri: string | null
} | null = null
let startedAt = 0

async function loadModules() {
  const [expoAudio, audioModule] = await Promise.all([
    import('expo-audio'),
    import('expo-audio/build/AudioModule'),
  ])
  return {
    RecordingPresets: expoAudio.RecordingPresets,
    requestRecordingPermissionsAsync: expoAudio.requestRecordingPermissionsAsync,
    setAudioModeAsync: expoAudio.setAudioModeAsync,
    AudioRecorder: audioModule.default.AudioRecorder,
  }
}

export function isRecordingSupported(): boolean {
  return isNativeRuntime()
}

export async function startRecording(): Promise<void> {
  const { AudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } =
    await loadModules()
  const permission = await requestRecordingPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Microphone permission is required to record.')
  }
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
  const next = new AudioRecorder(RecordingPresets.HIGH_QUALITY)
  await next.prepareToRecordAsync()
  next.record()
  recorder = next
  startedAt = Date.now()
}

export async function stopRecording(): Promise<RecordedAudio | null> {
  const current = recorder
  if (!current) return null
  recorder = null
  const durationMs = Date.now() - startedAt
  await current.stop()
  const uri = current.uri
  if (!uri) return null
  return {
    uri,
    mimeType: 'audio/m4a',
    durationMs,
    fileName: `voice-${Date.now()}.m4a`,
  }
}

export async function cancelRecording(): Promise<void> {
  const current = recorder
  recorder = null
  if (current) {
    try {
      await current.stop()
    } catch {
      // ignore
    }
  }
}
