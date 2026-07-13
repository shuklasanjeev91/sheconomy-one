import type { RecordedAudio } from '~/lib/media/audio-recorder'

export type { RecordedAudio }

let mediaRecorder: MediaRecorder | null = null
let chunks: Blob[] = []
let stream: MediaStream | null = null
let startedAt = 0

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return ''
}

export async function startRecording(): Promise<void> {
  if (!isRecordingSupported()) {
    throw new Error('Recording is not supported in this browser.')
  }
  stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  chunks = []
  const mime = pickMimeType()
  mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data)
  }
  mediaRecorder.start()
  startedAt = Date.now()
}

export async function stopRecording(): Promise<RecordedAudio | null> {
  const recorder = mediaRecorder
  if (!recorder) return null
  const durationMs = Date.now() - startedAt
  const blob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
    recorder.stop()
  })
  cleanup()
  const mimeType = blob.type || 'audio/webm'
  const ext = mimeType.includes('mp4') ? 'm4a' : 'webm'
  return {
    uri: URL.createObjectURL(blob),
    mimeType,
    durationMs,
    fileName: `voice-${Date.now()}.${ext}`,
    blob,
  }
}

export async function cancelRecording(): Promise<void> {
  const recorder = mediaRecorder
  if (recorder && recorder.state !== 'inactive') {
    try {
      recorder.stop()
    } catch {
      // ignore
    }
  }
  cleanup()
}

function cleanup() {
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  mediaRecorder = null
  chunks = []
}
