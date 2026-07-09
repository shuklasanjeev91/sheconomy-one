import { hasSpeechRecognition, isNativeRuntime } from '~/lib/platform/capabilities'

export type LiveCaptionLine = {
  id: string
  userId: string
  speaker: string
  text: string
  isFinal: boolean
  timestamp: number
}

/** Web Speech API on browsers; native apps receive shared captions from the room. */
export function isLiveCaptionsSupported() {
  return hasSpeechRecognition() || isNativeRuntime()
}

export function canPublishLiveCaptions() {
  return hasSpeechRecognition()
}

export function formatCaptionTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}
