import { isNativeRuntime } from '~/lib/platform/capabilities'

let nativeRecorder: {
  stop: () => Promise<void>
  uri: string | null
} | null = null

async function loadNativeRecordingModules() {
  const [expoAudio, audioModule, sharing] = await Promise.all([
    import('expo-audio'),
    import('expo-audio/build/AudioModule'),
    import('expo-sharing'),
  ])

  return {
    RecordingPresets: expoAudio.RecordingPresets,
    requestRecordingPermissionsAsync: expoAudio.requestRecordingPermissionsAsync,
    setAudioModeAsync: expoAudio.setAudioModeAsync,
    AudioRecorder: audioModule.default.AudioRecorder,
    Sharing: sharing.default,
  }
}

export function isNativeAudioRecordingSupported() {
  return isNativeRuntime()
}

export async function startNativeAudioRecording() {
  if (!isNativeRuntime()) {
    throw new Error('Native audio recording is only available on iOS and Android')
  }

  const { AudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } =
    await loadNativeRecordingModules()
  const permission = await requestRecordingPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Microphone permission is required to record')
  }

  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  })

  const recorder = new AudioRecorder(RecordingPresets.HIGH_QUALITY)
  await recorder.prepareToRecordAsync()
  recorder.record()
  nativeRecorder = recorder
}

export async function stopNativeAudioRecording(meetingCode: string) {
  const recording = nativeRecorder
  if (!recording) return

  nativeRecorder = null
  const { Sharing } = await loadNativeRecordingModules()
  await recording.stop()
  const uri = recording.uri
  if (!uri) return

  const canShare = await Sharing.isAvailableAsync()
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'audio/m4a',
      dialogTitle: `Sheconomy meeting ${meetingCode}`,
    })
    return
  }

  throw new Error('Sharing is not available on this device')
}

export async function cancelNativeAudioRecording() {
  if (!nativeRecorder) return
  const recording = nativeRecorder
  nativeRecorder = null
  await recording.stop()
}
