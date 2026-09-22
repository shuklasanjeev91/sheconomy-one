import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  captionLanguageName,
  captionLooksLikeTargetLang,
  localizeCaptionLine,
  resolveLiveCaptionDisplay,
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
  /** Caption display / translation language for this viewer. */
  targetLang: string
  /**
   * Speech-to-text language for this device.
   * `auto` follows `targetLang` (Zoom-style: captions language drives recognition).
   */
  spokenLang: 'auto' | string
  collapsed: boolean
  size: CaptionOverlaySize
  placement: CaptionOverlayPlacement
  /** Free-drag offset from the default corner (px). */
  offsetX: number
  offsetY: number
}

const CAPTION_PREFERENCE_PREFIX = 'cowork.live-captions.v2'
const VALID_LANGUAGES = new Set<string>(REGION_LANGUAGES.map((language) => language.code))
const VALID_SIZES = new Set<CaptionOverlaySize>(['compact', 'comfortable', 'large'])

export function normalizeLiveCaptionPreferences(
  value: Partial<LiveCaptionPreferences> | null | undefined,
  fallbackLanguage = 'en',
): LiveCaptionPreferences {
  const fallback = VALID_LANGUAGES.has(fallbackLanguage.toLowerCase())
    ? fallbackLanguage.toLowerCase()
    : 'en'
  const targetLang =
    typeof value?.targetLang === 'string' && VALID_LANGUAGES.has(value.targetLang.toLowerCase())
      ? value.targetLang.toLowerCase()
      : fallback
  const spokenRaw =
    typeof value?.spokenLang === 'string' ? value.spokenLang.toLowerCase() : 'auto'
  const spokenLang =
    spokenRaw === 'auto' || VALID_LANGUAGES.has(spokenRaw) ? spokenRaw : 'auto'
  return {
    targetLang,
    spokenLang,
    collapsed: value?.collapsed === true,
    size: value?.size && VALID_SIZES.has(value.size) ? value.size : 'comfortable',
    placement: value?.placement === 'top' ? 'top' : 'bottom',
    offsetX:
      typeof value?.offsetX === 'number' && Number.isFinite(value.offsetX)
        ? Math.round(value.offsetX)
        : 0,
    offsetY:
      typeof value?.offsetY === 'number' && Number.isFinite(value.offsetY)
        ? Math.round(value.offsetY)
        : 0,
  }
}

type UseLiveCaptionsOptions = {
  userId: string
  displayName: string
  enabled: boolean
  remoteCaptions: LiveCaptionLine[]
  /** True when any peer (including self) wants captions — keep STT publishing. */
  roomWantsCaptions?: boolean
  onFinalCaption?: (text: string, sourceLang: string) => void
  /** Final + interim publish so peers see live Zoom-style captions. */
  onPublishCaption?: (text: string, sourceLang: string, isFinal: boolean) => void
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
  roomWantsCaptions = false,
  onFinalCaption,
  onPublishCaption,
}: UseLiveCaptionsOptions) {
  const region = useOptionalRegionPreferences()
  const regionLanguage = (region?.languageCode || 'en').toLowerCase()
  const [preferences, setPreferences] = useState<LiveCaptionPreferences>(() =>
    normalizeLiveCaptionPreferences(null, regionLanguage),
  )
  const [preferencesHydrated, setPreferencesHydrated] = useState(false)
  const targetLang = preferences.targetLang
  const targetLangName = captionLanguageName(targetLang)
  // STT uses spoken language (device region by default). Display/translation uses
  // targetLang so A can speak English while B reads Hindi captions.
  const spokenLangCode =
    preferences.spokenLang === 'auto' ? regionLanguage : preferences.spokenLang
  const speakLocale = speechRecognitionLocale(
    spokenLangCode,
    region?.countryCode || 'IN',
  )

  const [active, setActive] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [liveCaptionText, setLiveCaptionText] = useState('')
  const [liveCaptionSpeaker, setLiveCaptionSpeaker] = useState('')
  const [localLines, setLocalLines] = useState<LiveCaptionLine[]>([])
  const [translatedRemote, setTranslatedRemote] = useState<LiveCaptionLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const nativeSessionRef = useRef<NativeSpeechSession | null>(null)
  const shouldRestartRef = useRef(false)
  const targetLangRef = useRef(targetLang)
  const spokenLangCodeRef = useRef(spokenLangCode)
  const speakLocaleRef = useRef(speakLocale)
  const activeRef = useRef(active)
  const publishingRef = useRef(publishing)
  const pendingLiveRawRef = useRef('')
  const lastGoodBySpeakerRef = useRef<Map<string, string>>(new Map())
  const localizedCacheRef = useRef<Map<string, LiveCaptionLine>>(new Map())
  const onFinalCaptionRef = useRef(onFinalCaption)
  const onPublishCaptionRef = useRef(onPublishCaption)
  const displayNameRef = useRef(displayName)
  const lastInterimBroadcastRef = useRef('')
  const lastInterimBroadcastAtRef = useRef(0)
  const startingLockRef = useRef(false)
  onFinalCaptionRef.current = onFinalCaption
  onPublishCaptionRef.current = onPublishCaption
  displayNameRef.current = displayName
  targetLangRef.current = targetLang
  spokenLangCodeRef.current = spokenLangCode
  speakLocaleRef.current = speakLocale
  activeRef.current = active
  publishingRef.current = publishing

  const supported = isLiveCaptionsSupported()
  const canPublish = canPublishLiveCaptions()

  const publishCaption = useCallback((text: string, isFinal: boolean) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const sourceLang = spokenLangCodeRef.current || 'auto'
    if (isFinal) {
      if (onPublishCaptionRef.current) {
        onPublishCaptionRef.current(trimmed, sourceLang, true)
      } else {
        onFinalCaptionRef.current?.(trimmed, sourceLang)
      }
      return
    }
    const now = Date.now()
    if (
      trimmed === lastInterimBroadcastRef.current &&
      now - lastInterimBroadcastAtRef.current < 250
    ) {
      return
    }
    lastInterimBroadcastRef.current = trimmed
    lastInterimBroadcastAtRef.current = now
    onPublishCaptionRef.current?.(trimmed, sourceLang, false)
  }, [])

  const commitFinalCaption = useCallback(
    (text: string) => {
      // Tag with the STT language we asked for; each viewer still auto-detects
      // when localizing into their own targetLang.
      const sourceLang = spokenLangCodeRef.current || 'auto'
      const line: LiveCaptionLine = {
        id: `${userId}-${Date.now()}`,
        userId,
        speaker: displayNameRef.current,
        text,
        originalText: text,
        sourceLang,
        targetLang: 'auto',
        translated: false,
        isFinal: true,
        timestamp: Date.now(),
      }
      void localizeCaptionLine(line, targetLangRef.current).then((localized) => {
        setLocalLines((current) => [...current.slice(-40), localized])
      })
      publishCaption(text, true)
      setInterimText('')
      lastInterimBroadcastRef.current = ''
    },
    [publishCaption, userId],
  )

  const startWebRecognition = useCallback(() => {
    const recognition = createSpeechRecognition()
    if (!recognition) {
      setError('Live captions are not supported in this browser')
      return false
    }

    recognition.lang = speakLocaleRef.current
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
      if (interim) {
        setError(null)
        setInterimText(interim)
        publishCaption(interim, false)
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('Microphone access is required for live captions')
        shouldRestartRef.current = false
        setPublishing(false)
        return
      }
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError('Live captions paused — retrying…')
      }
    }

    recognition.onend = () => {
      if (shouldRestartRef.current) {
        try {
          recognition.lang = speakLocaleRef.current
          recognition.start()
        } catch {
          setPublishing(false)
        }
      } else {
        setPublishing(false)
      }
    }

    shouldRestartRef.current = true
    recognitionRef.current = recognition
    recognition.start()
    return true
  }, [commitFinalCaption, publishCaption])

  const startNativeRecognition = useCallback(async () => {
    const session = await createNativeSpeechSession({
      onPartial: (text) => {
        setError(null)
        setInterimText(text)
        publishCaption(text, false)
      },
      onFinal: (text) => {
        setError(null)
        commitFinalCaption(text)
      },
      onError: (message) => {
        // Soft banners only for mic denial. Transient STT issues must not cover the stage —
        // remote captions still work while viewing.
        const lower = message.toLowerCase()
        if (lower.includes('microphone')) {
          setError(message)
          shouldRestartRef.current = false
          setPublishing(false)
          return
        }
        // Ignore soft/unavailable STT noise (common during LiveKit audio sessions).
      },
    })
    if (!session) {
      // Keep CC active for viewing room captions; show a soft hint once.
      setError('Could not start speech recognition on this device. You can still view others’ captions.')
      return false
    }
    nativeSessionRef.current = session
    shouldRestartRef.current = true
    try {
      await session.start(speakLocaleRef.current)
      setError(null)
      return true
    } catch {
      setError('Could not start speech recognition. You can still view others’ captions.')
      return false
    }
  }, [commitFinalCaption, publishCaption])

  const startRecognition = useCallback(() => {
    if (!canPublish) {
      setError(null)
      setPublishing(false)
      return
    }
    if (publishingRef.current && (recognitionRef.current || nativeSessionRef.current)) {
      return
    }
    if (startingLockRef.current) return
    startingLockRef.current = true

    setError(null)
    void (async () => {
      try {
        if (isNativeRuntime()) {
          const started = await startNativeRecognition()
          setPublishing(started)
          return
        }

        if (!hasSpeechRecognition() || !startWebRecognition()) {
          setPublishing(false)
          return
        }
        setPublishing(true)
      } catch {
        setError('Could not start live captions')
        setPublishing(false)
      } finally {
        startingLockRef.current = false
      }
    })()
  }, [canPublish, startNativeRecognition, startWebRecognition])

  const stopRecognition = useCallback(() => {
    shouldRestartRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    const native = nativeSessionRef.current
    nativeSessionRef.current = null
    if (native) void native.destroy()
    setInterimText('')
    setLiveCaptionText('')
    setLiveCaptionSpeaker('')
    setPublishing(false)
  }, [])

  const toggleCaptions = useCallback(() => {
    if (active) {
      setActive(false)
      // Keep publishing if someone else in the room still wants captions.
      if (!roomWantsCaptions) stopRecognition()
      return
    }
    setPreferences((current) => ({ ...current, collapsed: false }))
    setActive(true)
    startRecognition()
  }, [active, roomWantsCaptions, startRecognition, stopRecognition])

  // Room-wide publish: when any peer wants captions, every device STTs its mic
  // so speech from A appears for B (and vice versa) in each viewer’s language.
  useEffect(() => {
    if (!enabled) {
      if (publishingRef.current) stopRecognition()
      if (activeRef.current) setActive(false)
      return
    }
    if (active || roomWantsCaptions) {
      startRecognition()
      return
    }
    if (publishingRef.current) stopRecognition()
  }, [active, enabled, roomWantsCaptions, startRecognition, stopRecognition])

  useEffect(() => {
    return () => stopRecognition()
  }, [stopRecognition])

  // Restart STT when the captions / spoken language changes so recognition
  // actually follows the picker (Zoom-style language switch mid-meeting).
  const prevSpeakLocaleRef = useRef(speakLocale)
  useEffect(() => {
    const previous = prevSpeakLocaleRef.current
    prevSpeakLocaleRef.current = speakLocale
    if (previous === speakLocale) return
    if (!publishingRef.current || !canPublish) return
    stopRecognition()
    startRecognition()
  }, [canPublish, speakLocale, startRecognition, stopRecognition])

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

  // Finalize history localization (non-live). Debounced; in-flight results still apply.
  useEffect(() => {
    const lang = targetLang
    const handle = setTimeout(() => {
      void (async () => {
        const finals = remoteCaptions.filter((line) => line.isFinal).slice(-20)
        const next = await Promise.all(
          finals.map(async (line) => {
            const original = (line.originalText || line.text).trim()
            const key = `${line.id}::${lang}::${original}`
            const cached = localizedCacheRef.current.get(key)
            if (cached) return cached
            const localized = await localizeCaptionLine(
              { ...line, originalText: original || line.text },
              lang,
            )
            localizedCacheRef.current.set(key, localized)
            return localized
          }),
        )
        setTranslatedRemote(next)
      })()
    }, 280)
    return () => clearTimeout(handle)
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

  // Live overlay: translate the current speaking line into THIS viewer's Show language.
  // Debounce aggressively and never blank the overlay between STT ticks (that caused
  // the "Listening…" / speaker flicker glitch on Android).
  useEffect(() => {
    if (!active) return

    let raw = interimText.trim()
    let speaker = displayNameRef.current
    let speakerId = userId
    let remoteTranslated: boolean | null = null
    if (!raw) {
      const remote = [...remoteCaptions]
        .filter((line) => (line.originalText || line.text).trim())
        .sort((a, b) => b.timestamp - a.timestamp)[0]
      // Ignore stale remotes so a quiet room does not revive an old line.
      if (remote && Date.now() - remote.timestamp < 10_000) {
        raw = (remote.originalText || remote.text).trim()
        speaker = remote.speaker
        speakerId = remote.userId
        remoteTranslated = remote.translated === true
      }
    }
    if (!raw) return

    pendingLiveRawRef.current = raw
    const lastGood = lastGoodBySpeakerRef.current.get(speakerId) || null
    const isLocal = speakerId === userId

    const display = resolveLiveCaptionDisplay({
      targetLang,
      localInterimRaw: isLocal ? raw : null,
      localInterimTranslated: isLocal && lastGood && captionLooksLikeTargetLang(lastGood, targetLang)
        ? lastGood
        : null,
      lastGoodLocalTranslated: isLocal ? lastGood : null,
      remoteInterimText: isLocal ? null : raw,
      remoteInterimTranslated: isLocal ? null : remoteTranslated,
      fallbackFinalText: lastGood,
    })

    if (display) {
      setLiveCaptionText(display)
      setLiveCaptionSpeaker(speaker)
      if (captionLooksLikeTargetLang(display, targetLang)) {
        lastGoodBySpeakerRef.current.set(speakerId, display)
      }
    } else {
      setLiveCaptionSpeaker(speaker)
    }

    if (captionLooksLikeTargetLang(raw, targetLang)) {
      return
    }

    const snap = raw
    const snapSpeaker = speaker
    const snapSpeakerId = speakerId
    const handle = setTimeout(() => {
      void translateCaptionText({
        text: snap,
        targetLang,
        sourceLang: 'auto',
      }).then((result) => {
        const pending = pendingLiveRawRef.current
        const stillRelevant =
          pending === snap ||
          pending.startsWith(snap) ||
          snap.startsWith(pending) ||
          pending.toLowerCase().includes(snap.toLowerCase().slice(0, Math.min(24, snap.length)))
        if (!stillRelevant) return

        const out = result.translatedText.trim()
        // Prefer translated text; if empty or script check fails, keep showing
        // raw/lastGood via resolveLiveCaptionDisplay — never blank the overlay.
        const next = resolveLiveCaptionDisplay({
          targetLang,
          localInterimRaw: snapSpeakerId === userId ? snap : null,
          localInterimTranslated: out || null,
          lastGoodLocalTranslated: lastGoodBySpeakerRef.current.get(snapSpeakerId) || null,
          remoteInterimText: snapSpeakerId === userId ? null : snap,
          remoteInterimTranslated: Boolean(out),
          fallbackFinalText: lastGoodBySpeakerRef.current.get(snapSpeakerId) || snap,
        })
        if (!next) return
        if (out && captionLooksLikeTargetLang(out, targetLang)) {
          lastGoodBySpeakerRef.current.set(snapSpeakerId, out)
        }
        setLiveCaptionText(next)
        setLiveCaptionSpeaker(snapSpeaker)
      })
    }, 220)

    return () => clearTimeout(handle)
  }, [active, displayName, interimText, remoteCaptions, roomWantsCaptions, targetLang, userId])

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

  const fallbackFinal = (() => {
    const last = visibleLines[visibleLines.length - 1]
    if (!last?.text?.trim()) return ''
    if (last.translated || captionLooksLikeTargetLang(last.text, targetLang)) return last.text.trim()
    return ''
  })()

  const currentCaption = (liveCaptionText.trim() || fallbackFinal).trim()

  // Once remote (or local) captions are flowing, drop soft STT warnings so the
  // orange banner does not stick over a working CC overlay.
  useEffect(() => {
    if (!error) return
    if (/microphone/i.test(error)) return
    if (currentCaption || visibleLines.length > 0 || interimText.trim()) {
      setError(null)
    }
  }, [currentCaption, error, interimText, visibleLines.length])

  const showingTranslation = Boolean(
    liveCaptionText &&
      !captionLooksLikeTargetLang(interimText || '', targetLang) &&
      captionLooksLikeTargetLang(liveCaptionText, targetLang),
  ) || visibleLines.some((line) => line.translated)

  const setTargetLang = useCallback((language: string) => {
    lastGoodBySpeakerRef.current.clear()
    setLiveCaptionText('')
    setPreferences((current) =>
      normalizeLiveCaptionPreferences(
        { ...current, targetLang: language },
        current.targetLang,
      ),
    )
  }, [])

  const setSpokenLang = useCallback((language: string) => {
    setPreferences((current) =>
      normalizeLiveCaptionPreferences(
        { ...current, spokenLang: language },
        current.targetLang,
      ),
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

  const setOverlayOffset = useCallback((offsetX: number, offsetY: number) => {
    setPreferences((current) => ({
      ...current,
      offsetX: Math.round(offsetX),
      offsetY: Math.round(offsetY),
    }))
  }, [])

  return {
    supported,
    canPublish,
    active,
    publishing,
    error,
    interimText,
    visibleLines,
    currentCaption,
    liveCaptionSpeaker,
    transcriptLines,
    targetLang,
    targetLangName,
    spokenLang: preferences.spokenLang,
    spokenLangCode,
    spokenLangName: captionLanguageName(spokenLangCode),
    showingTranslation,
    captionPreferences: preferences,
    availableLanguages: REGION_LANGUAGES,
    setTargetLang,
    setSpokenLang,
    setCollapsed,
    setOverlaySize,
    setPlacement,
    setOverlayOffset,
    toggleCaptions,
    setActive,
  }
}
