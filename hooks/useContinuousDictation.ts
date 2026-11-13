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

export type UseContinuousDictationOptions = {
  /** Called with the live interim phrase for the current utterance. */
  onPartial?: (text: string) => void
  /** Called each time a final phrase is committed (listening continues). */
  onFinal?: (text: string) => void
  locale?: string
}

function createWebSpeechRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === 'undefined') return null
  const ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!ctor) return null
  return new ctor() as SpeechRecognitionInstance
}

export function isContinuousDictationAvailable() {
  if (isWebRuntime()) return hasSpeechRecognition()
  if (isNativeRuntime()) return true
  return false
}

/**
 * Continuous speech-to-text for live typing into focused fields.
 * Restarts after each utterance (web continuous + native Voice end).
 */
export function useContinuousDictation(options: UseContinuousDictationOptions = {}) {
  const { onPartial, onFinal, locale = 'en-IN' } = options
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(() => isContinuousDictationAvailable())
  const [error, setError] = useState<string | null>(null)

  const webRef = useRef<SpeechRecognitionInstance | null>(null)
  const nativeRef = useRef<NativeSpeechSession | null>(null)
  const shouldRunRef = useRef(false)
  const localeRef = useRef(locale)
  const onPartialRef = useRef(onPartial)
  const onFinalRef = useRef(onFinal)
  localeRef.current = locale
  onPartialRef.current = onPartial
  onFinalRef.current = onFinal

  useEffect(() => {
    if (!isNativeRuntime()) {
      setSupported(isContinuousDictationAvailable())
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
    shouldRunRef.current = false
    const web = webRef.current
    if (web) {
      try {
        web.stop()
        web.abort?.()
      } catch {
        // ignore
      }
      web.onresult = null
      web.onerror = null
      web.onend = null
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

  const startWeb = useCallback(() => {
    const recognition = createWebSpeechRecognition()
    if (!recognition) {
      setSupported(false)
      setError('Dictation is not supported in this browser.')
      return
    }

    let serviceFailures = 0
    recognition.lang = localeRef.current
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      serviceFailures = 0
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
      if (finalText) onFinalRef.current?.(finalText)
    }

    recognition.onerror = (event) => {
      const code = event.error || ''
      if (code === 'aborted' || code === 'no-speech') return
      if (code === 'not-allowed') {
        shouldRunRef.current = false
        setError('Microphone access is required for dictation.')
        setListening(false)
        return
      }
      if (code === 'network' || code === 'service-not-allowed') {
        serviceFailures += 1
        if (serviceFailures >= 3) {
          shouldRunRef.current = false
          setError('Speech recognition is unavailable in this browser. Try Chrome, Edge, or Safari.')
          setListening(false)
        }
        return
      }
      setError('Could not hear that — retrying…')
    }

    recognition.onend = () => {
      if (webRef.current !== recognition) return
      if (!shouldRunRef.current) {
        setListening(false)
        webRef.current = null
        return
      }
      const restart = () => {
        if (!shouldRunRef.current || webRef.current !== recognition) return
        try {
          recognition.lang = localeRef.current
          recognition.start()
          setListening(true)
        } catch {
          setListening(false)
        }
      }
      if (serviceFailures > 0) setTimeout(restart, 400 * serviceFailures)
      else restart()
    }

    webRef.current = recognition
    shouldRunRef.current = true
    try {
      recognition.start()
      setListening(true)
      setError(null)
    } catch {
      setError('Could not start dictation.')
      setListening(false)
      shouldRunRef.current = false
      webRef.current = null
    }
  }, [])

  const startNative = useCallback(async () => {
    const session = await createNativeSpeechSession({
      onPartial: (text) => onPartialRef.current?.(text),
      onFinal: (text) => onFinalRef.current?.(text),
      onError: (message) => {
        if (/microphone|permission|authorized/i.test(message)) {
          shouldRunRef.current = false
          setError('Microphone access is required for dictation.')
          setListening(false)
          return
        }
        setError('Could not hear that — retrying…')
      },
      onEnd: () => {
        if (!shouldRunRef.current) {
          setListening(false)
          return
        }
        // Native Voice ends after each utterance — restart for continuous typing.
        void (async () => {
          const current = nativeRef.current
          if (!current || !shouldRunRef.current) return
          try {
            await current.start(localeRef.current)
            setListening(true)
          } catch {
            setListening(false)
          }
        })()
      },
    })

    if (!session) {
      setSupported(false)
      setError('Dictation is not available on this device.')
      return
    }

    nativeRef.current = session
    shouldRunRef.current = true
    try {
      await session.start(localeRef.current)
      setListening(true)
      setError(null)
    } catch {
      setError('Could not start dictation.')
      setListening(false)
      shouldRunRef.current = false
      await session.destroy()
      nativeRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    await stop()
    if (isWebRuntime()) {
      startWeb()
      return
    }
    if (isNativeRuntime()) {
      await startNative()
      return
    }
    setSupported(false)
  }, [startNative, startWeb, stop])

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
