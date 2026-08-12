import { hasSpeechRecognition, isNativeRuntime } from '~/lib/platform/capabilities'
import { createWebSpeechSession } from '~/co-work/lib/web-speech-recognition'

export type NativeSpeechHandlers = {
  onPartial?: (text: string) => void
  onFinal?: (text: string) => void
  onError?: (message: string) => void
  onEnd?: () => void
}

export type NativeSpeechSession = {
  start: (locale: string) => Promise<void>
  stop: () => Promise<void>
  destroy: () => Promise<void>
}

/** Web: SpeechRecognition when available; native Voice lives in `.native.ts`. */
export function isNativeSpeechRecognitionAvailable() {
  if (isNativeRuntime()) return false
  return hasSpeechRecognition()
}

export async function createNativeSpeechSession(
  handlers: NativeSpeechHandlers,
): Promise<NativeSpeechSession | null> {
  if (isNativeRuntime()) return null
  return createWebSpeechSession(handlers)
}
