import { useCallback, useEffect, useRef, useState } from 'react'

import {
  canPublishLiveCaptions,
  isLiveCaptionsSupported,
  type LiveCaptionLine,
} from '~/co-work/lib/live-captions'

type UseLiveCaptionsOptions = {
  userId: string
  displayName: string
  enabled: boolean
  remoteCaptions: LiveCaptionLine[]
  onFinalCaption?: (text: string) => void
}

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
}

function createSpeechRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === 'undefined') return null
  const ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!ctor) return null
  return new ctor() as SpeechRecognitionInstance
}

export function useLiveCaptions({
  userId,
  displayName,
  enabled,
  remoteCaptions,
  onFinalCaption,
}: UseLiveCaptionsOptions) {
  const [active, setActive] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [localLines, setLocalLines] = useState<LiveCaptionLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const shouldRestartRef = useRef(false)

  const supported = isLiveCaptionsSupported()
  const canPublish = canPublishLiveCaptions()

  const stopRecognition = useCallback(() => {
    shouldRestartRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setInterimText('')
  }, [])

  const startRecognition = useCallback(() => {
    if (!canPublish) {
      setError(null)
      setActive(true)
      return
    }

    const recognition = createSpeechRecognition()
    if (!recognition) {
      setError('Live captions are not supported in this browser')
      return
    }

    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result[0]?.transcript?.trim()
        if (!text) continue

        if (result.isFinal) {
          const line: LiveCaptionLine = {
            id: `${userId}-${Date.now()}-${index}`,
            userId,
            speaker: displayName,
            text,
            isFinal: true,
            timestamp: Date.now(),
          }
          setLocalLines((current) => [...current.slice(-40), line])
          onFinalCaption?.(text)
          setInterimText('')
        } else {
          interim = text
        }
      }
      if (interim) setInterimText(interim)
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('Microphone access is required for live captions')
        shouldRestartRef.current = false
        setActive(false)
        return
      }
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError('Live captions paused — retrying…')
      }
    }

    recognition.onend = () => {
      if (shouldRestartRef.current) {
        try {
          recognition.start()
        } catch {
          setActive(false)
        }
      }
    }

    shouldRestartRef.current = true
    recognitionRef.current = recognition
    setError(null)
    try {
      recognition.start()
      setActive(true)
    } catch {
      setError('Could not start live captions')
      setActive(false)
    }
  }, [canPublish, displayName, onFinalCaption, userId])

  const toggleCaptions = useCallback(() => {
    if (active) {
      stopRecognition()
      setActive(false)
      return
    }
    startRecognition()
  }, [active, startRecognition, stopRecognition])

  useEffect(() => {
    return () => stopRecognition()
  }, [stopRecognition])

  useEffect(() => {
    if (!enabled && active) {
      stopRecognition()
      setActive(false)
    }
  }, [active, enabled, stopRecognition])

  const visibleLines = [...remoteCaptions, ...localLines]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-6)

  const transcriptLines = [...remoteCaptions, ...localLines]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((line) => `[${new Date(line.timestamp).toISOString()}] ${line.speaker}: ${line.text}`)

  const currentCaption =
    interimText ||
    (visibleLines.length > 0 ? visibleLines[visibleLines.length - 1]?.text : '') ||
    ''

  return {
    supported,
    canPublish,
    active,
    error,
    interimText,
    visibleLines,
    currentCaption,
    transcriptLines,
    toggleCaptions,
    setActive,
  }
}
