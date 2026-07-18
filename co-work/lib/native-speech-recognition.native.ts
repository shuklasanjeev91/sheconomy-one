import Voice, {
  type SpeechErrorEvent,
  type SpeechResultsEvent,
} from '@react-native-voice/voice'

import { isNativeRuntime } from '~/lib/platform/capabilities'

import type { NativeSpeechHandlers, NativeSpeechSession } from './native-speech-recognition'

export function isNativeSpeechRecognitionAvailable() {
  return isNativeRuntime()
}

export async function createNativeSpeechSession(
  handlers: NativeSpeechHandlers,
): Promise<NativeSpeechSession | null> {
  if (!isNativeRuntime()) return null

  try {
    const available = await Voice.isAvailable()
    if (!available) return null
  } catch {
    return null
  }

  let shouldRestart = false
  let locale = 'en-US'
  let starting = false

  const onSpeechPartialResults = (event: SpeechResultsEvent) => {
    const text = event.value?.[0]?.trim()
    if (text) handlers.onPartial?.(text)
  }

  const onSpeechResults = (event: SpeechResultsEvent) => {
    const text = event.value?.[0]?.trim()
    if (text) handlers.onFinal?.(text)
  }

  const onSpeechError = (event: SpeechErrorEvent) => {
    const code = String(event.error?.code ?? '')
    const message = String(event.error?.message ?? 'Speech recognition error')
    if (code.includes('7') || /no.?speech/i.test(message)) return
    if (/permission|not.?authorized|denied/i.test(message)) {
      shouldRestart = false
      handlers.onError?.('Microphone access is required for live captions')
      return
    }
    handlers.onError?.('Live captions paused — retrying…')
  }

  const onSpeechEnd = () => {
    handlers.onEnd?.()
    if (!shouldRestart || starting) return
    starting = true
    void Voice.start(locale)
      .catch(() => {
        shouldRestart = false
        handlers.onError?.('Could not restart live captions')
      })
      .finally(() => {
        starting = false
      })
  }

  Voice.onSpeechPartialResults = onSpeechPartialResults
  Voice.onSpeechResults = onSpeechResults
  Voice.onSpeechError = onSpeechError
  Voice.onSpeechEnd = onSpeechEnd

  return {
    async start(nextLocale: string) {
      locale = nextLocale || 'en-US'
      shouldRestart = true
      await Voice.start(locale)
    },
    async stop() {
      shouldRestart = false
      try {
        await Voice.stop()
      } catch {
        // ignore
      }
    },
    async destroy() {
      shouldRestart = false
      try {
        await Voice.stop()
      } catch {
        // ignore
      }
      try {
        await Voice.destroy()
      } catch {
        // ignore
      }
      Voice.removeAllListeners()
    },
  }
}
