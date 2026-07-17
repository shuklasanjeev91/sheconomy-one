import { isNativeRuntime } from '~/lib/platform/capabilities'

import {
  configureLiveKitCallAudio,
  getActiveCallMediaMode,
} from '~/co-work/lib/livekit-call-audio'
import type { LiveKitMediaMode } from '~/co-work/lib/livekit-media-controls'

let nativeRecorder: {
  stop: () => Promise<void>
  uri: string | null
} | null = null

/**
 * expo-audio's setAudioModeAsync reconfigures the OS audio session and breaks
 * LiveKit's in-call routing (remote participants go silent for the recorder —
 * i.e. the host). Re-assert the call session after any recorder transition,
 * using the active media mode so voice calls stay on earpiece.
 */
async function restoreCallAudioSession(mediaMode?: LiveKitMediaMode) {
  try {
    await configureLiveKitCallAudio(mediaMode ?? getActiveCallMediaMode())
  } catch {
    // Best-effort: without a live room there is nothing to restore.
  }
}

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

  const mode = getActiveCallMediaMode()
  const { AudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } =
    await loadNativeRecordingModules()
  const permission = await requestRecordingPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Microphone permission is required to record')
  }

  try {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    })

    const recorder = new AudioRecorder(RecordingPresets.HIGH_QUALITY)
    await recorder.prepareToRecordAsync()
    recorder.record()
    nativeRecorder = recorder
  } finally {
    // setAudioModeAsync replaces the call audio session — restore it so the
    // recording host keeps hearing remote participants on the correct route.
    await restoreCallAudioSession(mode)
  }
}

export async function stopNativeAudioRecording(meetingCode: string) {
  const recording = nativeRecorder
  if (!recording) return

  const mode = getActiveCallMediaMode()
  nativeRecorder = null
  try {
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
  } finally {
    await restoreCallAudioSession(mode)
  }
}

export async function cancelNativeAudioRecording() {
  if (!nativeRecorder) return
  const mode = getActiveCallMediaMode()
  const recording = nativeRecorder
  nativeRecorder = null
  try {
    await recording.stop()
  } finally {
    await restoreCallAudioSession(mode)
  }
}
