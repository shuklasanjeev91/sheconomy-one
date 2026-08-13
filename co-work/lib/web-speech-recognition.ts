/**
 * Shared Web Speech API session with the same shape as native Voice sessions.
 */

import { hasSpeechRecognition } from '~/lib/platform/capabilities'
import type { NativeSpeechHandlers, NativeSpeechSession } from '~/co-work/lib/native-speech-recognition'

type SpeechRecognitionInstance = SpeechRecognition & {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}

function createRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === 'undefined') return null
  const ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!ctor) return null
  return new ctor() as SpeechRecognitionInstance
}

export function createWebSpeechSession(handlers: NativeSpeechHandlers): NativeSpeechSession | null {
  if (!hasSpeechRecognition()) return null
  const recognition = createRecognition()
  if (!recognition) return null

  let active = false

  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    let interim = ''
    let finalText = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      const transcript = result?.[0]?.transcript?.trim() ?? ''
      if (!transcript) continue
      if (result.isFinal) finalText = transcript
      else interim = transcript
    }
    if (interim) handlers.onPartial?.(interim)
    if (finalText) handlers.onFinal?.(finalText)
  }

  recognition.onerror = (event) => {
    const message =
      event.error === 'not-allowed'
        ? 'Microphone permission is required for voice search.'
        : event.error === 'no-speech'
          ? 'No speech detected. Try again.'
          : 'Voice search failed. Try again.'
    handlers.onError?.(message)
  }

  recognition.onend = () => {
    active = false
    handlers.onEnd?.()
  }

  return {
    async start(locale: string) {
      recognition.lang = locale || 'en-IN'
      if (active) {
        try {
          recognition.stop()
        } catch {
          // ignore
        }
      }
      active = true
      recognition.start()
    },
    async stop() {
      try {
        recognition.stop()
      } catch {
        // ignore
      }
      active = false
    },
    async destroy() {
      try {
        recognition.abort?.()
        recognition.stop()
      } catch {
        // ignore
      }
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      active = false
    },
  }
}
