import { hasSpeechRecognition, isNativeRuntime } from '~/lib/platform/capabilities'

export type LiveCaptionLine = {
  id: string
  userId: string
  speaker: string
  text: string
  /** Original spoken/STT text before viewer translation. */
  originalText?: string
  sourceLang?: string | null
  targetLang?: string | null
  translated?: boolean
  isFinal: boolean
  timestamp: number
}

/** Web Speech API on browsers; Voice STT on iOS/Android. Viewing shared captions is always available. */
export function isLiveCaptionsSupported() {
  return true
}

/** Publish captions from this device's microphone. */
export function canPublishLiveCaptions() {
  return hasSpeechRecognition() || isNativeRuntime()
}

export function formatCaptionTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}
