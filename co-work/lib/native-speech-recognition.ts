import { isNativeRuntime } from '~/lib/platform/capabilities'

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

/** Web: native Voice module is unavailable. */
export function isNativeSpeechRecognitionAvailable() {
  return false
}

export async function createNativeSpeechSession(
  _handlers: NativeSpeechHandlers,
): Promise<NativeSpeechSession | null> {
  if (!isNativeRuntime()) return null
  return null
}
