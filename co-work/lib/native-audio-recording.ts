import { isNativeRuntime } from '~/lib/platform/capabilities'

let nativeRecording: { stopAndUnloadAsync: () => Promise<void>; getURI: () => string | null } | null = null

async function loadNativeRecordingModules() {
  const [{ Audio }, Sharing] = await Promise.all([import('expo-av'), import('expo-sharing')])
  return { Audio, Sharing }
}

export function isNativeAudioRecordingSupported() {
  return isNativeRuntime()
}

export async function startNativeAudioRecording() {
  if (!isNativeRuntime()) {
    throw new Error('Native audio recording is only available on iOS and Android')
  }

  const { Audio } = await loadNativeRecordingModules()
  const permission = await Audio.requestPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Microphone permission is required to record')
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  })

  const recording = new Audio.Recording()
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
  await recording.startAsync()
  nativeRecording = recording
}

export async function stopNativeAudioRecording(meetingCode: string) {
  const recording = nativeRecording
  if (!recording) return

  nativeRecording = null
  const { Sharing } = await loadNativeRecordingModules()
  await recording.stopAndUnloadAsync()
  const uri = recording.getURI()
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
  if (!nativeRecording) return
  const recording = nativeRecording
  nativeRecording = null
  await recording.stopAndUnloadAsync()
}
