export type RecordedAudio = {
  uri: string
  mimeType: string
  durationMs: number
  fileName: string
  blob?: Blob
}

export function isRecordingSupported(): boolean {
  return false
}

export async function startRecording(): Promise<void> {}

export async function stopRecording(): Promise<RecordedAudio | null> {
  return null
}

export async function cancelRecording(): Promise<void> {}
