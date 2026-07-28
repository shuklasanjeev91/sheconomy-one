import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createNativeSpeechSession,
  type NativeSpeechSession,
} from '~/co-work/lib/native-speech-recognition'
import { hasSpeechRecognition, isNativeRuntime, isWebRuntime } from '~/lib/platform/capabilities'

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

export type UseVoiceSearchOptions = {
  /** Called with interim transcript while listening. */
  onPartial?: (text: string) => void
  /** Called once with the final phrase (then listening stops). */
  onFinal?: (text: string) => void
  locale?: string
}

function createWebSpeechRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === 'undefined') return null
  const ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!ctor) return null
  return new ctor() as SpeechRecognitionInstance
}

export function isVoiceSearchAvailable() {
  if (isWebRuntime()) return hasSpeechRecognition()
  if (isNativeRuntime()) return true
  return false
}

/**
 * One-shot speech-to-text for the omnibox (not continuous captions).
 */
export function useVoiceSearch(options: UseVoiceSearchOptions = {}) {
  const { onPartial, onFinal, locale = 'en-IN' } = options
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(() => isVoiceSearchAvailable())
  const [error, setError] = useState<string | null>(null)

  const webRef = useRef<SpeechRecognitionInstance | null>(null)
  const nativeRef = useRef<NativeSpeechSession | null>(null)
  const onPartialRef = useRef(onPartial)
  const onFinalRef = useRef(onFinal)
  onPartialRef.current = onPartial
  onFinalRef.current = onFinal

  useEffect(() => {
    if (!isNativeRuntime()) {
      setSupported(isVoiceSearchAvailable())
      return
    }
    let cancelled = false
    void createNativeSpeechSession({}).then(async (session) => {
      if (cancelled) {
        await session?.destroy()
        return
      }
      setSupported(Boolean(session))
      await session?.destroy()
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stop = useCallback(async () => {
    const web = webRef.current
    if (web) {
      try {
        web.stop()
      } catch {
        // ignore
      }
      webRef.current = null
    }
    const native = nativeRef.current
    if (native) {
      try {
        await native.stop()
        await native.destroy()
      } catch {
        // ignore
      }
      nativeRef.current = null
    }
    setListening(false)
  }, [])

  useEffect(() => {
    return () => {
      void stop()
    }
  }, [stop])

  const start = useCallback(async () => {
    setError(null)
    await stop()

    if (isWebRuntime()) {
      const recognition = createWebSpeechRecognition()
      if (!recognition) {
        setSupported(false)
        setError('Voice search is not supported in this browser.')
        return
      }

      recognition.lang = locale
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
        if (interim) onPartialRef.current?.(interim)
        if (finalText) {
          onPartialRef.current?.(finalText)
          onFinalRef.current?.(finalText)
          void stop()
        }
      }

      recognition.onerror = (event) => {
        const code = event.error || ''
        if (code === 'aborted' || code === 'no-speech') {
          setListening(false)
          return
        }
        if (code === 'not-allowed') {
          setError('Microphone access is required for voice search.')
        } else {
          setError('Could not hear that. Try again.')
        }
        setListening(false)
      }

      recognition.onend = () => {
        setListening(false)
        webRef.current = null
      }

      webRef.current = recognition
      try {
        recognition.start()
        setListening(true)
      } catch {
        setError('Could not start voice search.')
        setListening(false)
      }
      return
    }

    if (!isNativeRuntime()) {
      setSupported(false)
      return
    }

    const session = await createNativeSpeechSession({
      onPartial: (text) => onPartialRef.current?.(text),
      onFinal: (text) => {
        onPartialRef.current?.(text)
        onFinalRef.current?.(text)
        void stop()
      },
      onError: (message) => {
        setError(
          /microphone|permission|authorized/i.test(message)
            ? 'Microphone access is required for voice search.'
            : 'Could not hear that. Try again.',
        )
        setListening(false)
      },
      onEnd: () => setListening(false),
    })

    if (!session) {
      setSupported(false)
      setError('Voice search is not available on this device.')
      return
    }

    nativeRef.current = session
    try {
      await session.start(locale)
      setListening(true)
    } catch {
      setError('Could not start voice search.')
      setListening(false)
      await session.destroy()
      nativeRef.current = null
    }
  }, [locale, stop])

  const toggle = useCallback(async () => {
    if (listening) await stop()
    else await start()
  }, [listening, start, stop])

  const clearError = useCallback(() => setError(null), [])

  return {
    supported,
    listening,
    error,
    start,
    stop,
    toggle,
    clearError,
  }
}
