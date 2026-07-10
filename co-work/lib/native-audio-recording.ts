export function isNativeAudioRecordingSupported() {
  return false
}

export async function startNativeAudioRecording() {
  throw new Error('Native audio recording is only available on iOS and Android')
}

export async function stopNativeAudioRecording(_meetingCode: string) {}

export async function cancelNativeAudioRecording() {}
