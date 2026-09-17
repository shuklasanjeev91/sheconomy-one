import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  captionLanguageName,
  localizeCaptionLine,
  speechRecognitionLocale,
  translateCaptionText,
} from '~/co-work/lib/caption-translate'
import {
  canPublishLiveCaptions,
  isLiveCaptionsSupported,
  type LiveCaptionLine,
} from '~/co-work/lib/live-captions'
import {
  createNativeSpeechSession,
  type NativeSpeechSession,
} from '~/co-work/lib/native-speech-recognition'
import { hasSpeechRecognition, isNativeRuntime } from '~/lib/platform/capabilities'
import { useOptionalRegionPreferences } from '~/lib/locale'
import { REGION_LANGUAGES } from '~/lib/locale/region-data'
import { readPersistentValue, writePersistentValue } from '~/lib/platform/storage'
import type {
  CaptionOverlayPlacement,
  CaptionOverlaySize,
} from '~/co-work/lib/caption-overlay-layout'

export type { CaptionOverlayPlacement, CaptionOverlaySize }

export type LiveCaptionPreferences = {
  targetLang: string
  collapsed: boolean
  size: CaptionOverlaySize
  placement: CaptionOverlayPlacement
}

const CAPTION_PREFERENCE_PREFIX = 'cowork.live-captions.v1'
const VALID_LANGUAGES = new Set<string>(REGION_LANGUAGES.map((language) => language.code))
const VALID_SIZES = new Set<CaptionOverlaySize>(['compact', 'comfortable', 'large'])

export function normalizeLiveCaptionPreferences(
  value: Partial<LiveCaptionPreferences> | null | undefined,
  fallbackLanguage = 'en',
): LiveCaptionPreferences {
  const fallback = VALID_LANGUAGES.has(fallbackLanguage.toLowerCase())
    ? fallbackLanguage.toLowerCase()
    : 'en'
  return {
    targetLang:
      typeof value?.targetLang === 'string' && VALID_LANGUAGES.has(value.targetLang.toLowerCase())
        ? value.targetLang.toLowerCase()
        : fallback,
    collapsed: value?.collapsed === true,
    size: value?.size && VALID_SIZES.has(value.size) ? value.size : 'comfortable',
    placement: value?.placement === 'top' ? 'top' : 'bottom',
  }
}

type UseLiveCaptionsOptions = {
  userId: string
  displayName: string
  enabled: boolean
  remoteCaptions: LiveCaptionLine[]
  onFinalCaption?: (text: string, sourceLang: string) => void
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
  const region = useOptionalRegionPreferences()
  const regionLanguage = (region?.languageCode || 'en').toLowerCase()
  const [preferences, setPreferences] = useState<LiveCaptionPreferences>(() =>
    normalizeLiveCaptionPreferences(null, regionLanguage),
  )
  const [preferencesHydrated, setPreferencesHydrated] = useState(false)
  const targetLang = preferences.targetLang
  const targetLangName = captionLanguageName(targetLang)
  const speakLocale = speechRecognitionLocale(
    regionLanguage,
    region?.countryCode || 'IN',
  )

  const [active, setActive] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [translatedInterim, setTranslatedInterim] = useState('')
  const [localLines, setLocalLines] = useState<LiveCaptionLine[]>([])
  const [translatedRemote, setTranslatedRemote] = useState<LiveCaptionLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const nativeSessionRef = useRef<NativeSpeechSession | null>(null)
  const shouldRestartRef = useRef(false)
  const targetLangRef = useRef(targetLang)
  const localizedCacheRef = useRef<Map<string, LiveCaptionLine>>(new Map())
  const onFinalCaptionRef = useRef(onFinalCaption)
  const displayNameRef = useRef(displayName)
  onFinalCaptionRef.current = onFinalCaption
  displayNameRef.current = displayName
  targetLangRef.current = targetLang

  const supported = isLiveCaptionsSupported()
  const canPublish = canPublishLiveCaptions()

  const commitFinalCaption = useCallback(
    (text: string) => {
      // Never claim the device region as the spoken language — STT text is
      // auto-detected on each viewer's device when localizing to targetLang.
      const line: LiveCaptionLine = {
        id: `${userId}-${Date.now()}`,
        userId,
        speaker: displayNameRef.current,
        text,
        originalText: text,
        sourceLang: 'auto',
        targetLang: 'auto',
        translated: false,
        isFinal: true,
        timestamp: Date.now(),
      }
      void localizeCaptionLine(line, targetLangRef.current).then((localized) => {
        setLocalLines((current) => [...current.slice(-40), localized])
      })
      onFinalCaptionRef.current?.(text, 'auto')
      setInterimText('')
      setTranslatedInterim('')
    },
    [userId],
  )

  const stopRecognition = useCallback(() => {
    shouldRestartRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    const native = nativeSessionRef.current
    nativeSessionRef.current = null
    if (native) void native.destroy()
    setInterimText('')
    setTranslatedInterim('')
  }, [])

  const startWebRecognition = useCallback(() => {
    const recognition = createSpeechRecognition()
    if (!recognition) {
      setError('Live captions are not supported in this browser')
      return false
    }

    recognition.lang = speakLocale
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result[0]?.transcript?.trim()
        if (!text) continue
        if (result.isFinal) commitFinalCaption(text)
        else interim = text
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
    recognition.start()
    return true
  }, [commitFinalCaption, speakLocale])

  const startNativeRecognition = useCallback(async () => {
    const session = await createNativeSpeechSession({
      onPartial: (text) => setInterimText(text),
      onFinal: (text) => commitFinalCaption(text),
      onError: (message) => {
        setError(message)
        if (message.toLowerCase().includes('microphone')) {
          shouldRestartRef.current = false
          setActive(false)
        }
      },
    })
    if (!session) {
      setError(null)
      setActive(true)
      return false
    }
    nativeSessionRef.current = session
    shouldRestartRef.current = true
    await session.start(speakLocale)
    return true
  }, [commitFinalCaption, speakLocale])

  const startRecognition = useCallback(() => {
    if (!canPublish) {
      setError(null)
      setActive(true)
      return
    }

    setError(null)
    void (async () => {
      try {
        if (isNativeRuntime()) {
          const started = await startNativeRecognition()
          if (started) {
            setActive(true)
            return
          }
          // Native Voice unavailable — still show remote captions.
          setActive(true)
          return
        }

        if (!hasSpeechRecognition() || !startWebRecognition()) {
          setActive(false)
          return
        }
        setActive(true)
      } catch {
        setError('Could not start live captions')
        setActive(false)
      }
    })()
  }, [canPublish, startNativeRecognition, startWebRecognition])

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
    let cancelled = false
    const key = `${CAPTION_PREFERENCE_PREFIX}:${userId}`
    void readPersistentValue(key).then((raw) => {
      if (cancelled) return
      let stored: Partial<LiveCaptionPreferences> | null = null
      try {
        stored = raw ? (JSON.parse(raw) as Partial<LiveCaptionPreferences>) : null
      } catch {
        stored = null
      }
      setPreferences(normalizeLiveCaptionPreferences(stored, regionLanguage))
      setPreferencesHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [regionLanguage, userId])

  useEffect(() => {
    if (!preferencesHydrated) return
    void writePersistentValue(
      `${CAPTION_PREFERENCE_PREFIX}:${userId}`,
      JSON.stringify(preferences),
    )
  }, [preferences, preferencesHydrated, userId])

  useEffect(() => {
    if (!enabled && active) {
      stopRecognition()
      setActive(false)
    }
  }, [active, enabled, stopRecognition])

  useEffect(() => {
    let cancelled = false
    const lang = targetLang

    async function run() {
      const next: LiveCaptionLine[] = []
      for (const line of remoteCaptions.slice(-40)) {
        const key = `${line.id}::${lang}`
        const cached = localizedCacheRef.current.get(key)
        if (cached) {
          next.push(cached)
          continue
        }
        const localized = await localizeCaptionLine(
          { ...line, originalText: line.originalText || line.text },
          lang,
        )
        if (cancelled) return
        localizedCacheRef.current.set(key, localized)
        next.push(localized)
      }
      if (!cancelled) setTranslatedRemote(next)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [remoteCaptions, targetLang])

  useEffect(() => {
    let cancelled = false
    async function rerunLocal() {
      const next = await Promise.all(
        localLines.map((line) =>
          localizeCaptionLine(
            {
              ...line,
              text: line.originalText || line.text,
              originalText: line.originalText || line.text,
            },
            targetLang,
          ),
        ),
      )
      if (!cancelled) setLocalLines(next)
    }
    if (localLines.some((line) => line.targetLang !== targetLang)) {
      void rerunLocal()
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLang])

  // Translate interim (partial) captions into the selected display language so
  // the live overlay matches finals — not the spoken/STT language.
  useEffect(() => {
    const text = interimText.trim()
    if (!text || !active) {
      setTranslatedInterim('')
      return
    }

    let cancelled = false
    const handle = setTimeout(() => {
      void translateCaptionText({
        text,
        targetLang,
        sourceLang: 'auto',
      }).then((result) => {
        if (cancelled) return
        setTranslatedInterim(result.translatedText.trim() || text)
      })
    }, 320)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [active, interimText, targetLang])

  const visibleLines = useMemo(
    () =>
      [...translatedRemote, ...localLines]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-6),
    [localLines, translatedRemote],
  )

  const transcriptLines = useMemo(
    () =>
      [...translatedRemote, ...localLines]
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((line) => {
          const original =
            line.originalText && line.originalText !== line.text
              ? ` (original: ${line.originalText})`
              : ''
          return `[${new Date(line.timestamp).toISOString()}] ${line.speaker}: ${line.text}${original}`
        }),
    [localLines, translatedRemote],
  )

  const currentCaption =
    (interimText
      ? translatedInterim ||
        // Avoid flashing English while Hindi (etc.) translation is in flight.
        (visibleLines.length > 0 ? visibleLines[visibleLines.length - 1]?.text : '') ||
        '…'
      : visibleLines.length > 0
        ? visibleLines[visibleLines.length - 1]?.text
        : '') || ''

  const showingTranslation = visibleLines.some((line) => line.translated)

  const setTargetLang = useCallback((language: string) => {
    setPreferences((current) =>
      normalizeLiveCaptionPreferences({ ...current, targetLang: language }, current.targetLang),
    )
  }, [])

  const setCollapsed = useCallback((collapsed: boolean) => {
    setPreferences((current) => ({ ...current, collapsed }))
  }, [])

  const setOverlaySize = useCallback((size: CaptionOverlaySize) => {
    setPreferences((current) => ({ ...current, size }))
  }, [])

  const setPlacement = useCallback((placement: CaptionOverlayPlacement) => {
    setPreferences((current) => ({ ...current, placement }))
  }, [])

  return {
    supported,
    canPublish,
    active,
    error,
    interimText,
    visibleLines,
    currentCaption,
    transcriptLines,
    targetLang,
    targetLangName,
    showingTranslation,
    captionPreferences: preferences,
    availableLanguages: REGION_LANGUAGES,
    setTargetLang,
    setCollapsed,
    setOverlaySize,
    setPlacement,
    toggleCaptions,
    setActive,
  }
}
