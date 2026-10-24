import type { LiveCaptionLine } from '~/co-work/lib/live-captions'
import { invokeOwnedAssist } from '~/lib/ai/owned-service'
import { languageLabel, languageLocale } from '~/lib/locale/region-data'

export type TranslateTextResult = {
  text: string
  translatedText: string
  detectedSourceLang: string | null
  targetLang: string
  usedFallback: boolean
  skipped?: boolean
}

const INDIC_LANGS = new Set(['hi', 'bn', 'mr', 'gu', 'pa', 'ta', 'te', 'kn', 'ml', 'or', 'ne', 'si'])

function baseLang(code: string | null | undefined): string {
  return (code || '').split('-')[0]?.trim().toLowerCase() || ''
}

// Script alone cannot separate Latin-alphabet languages, so English speech used to
// "match" a Spanish/French/… viewer and was never translated.
const LATIN_STOPWORDS: Record<string, Set<string>> = {
  en: new Set(
    'the and is are was were you we i to of in it that this will would please hello hi be have has for with on can what do does not our your they them there here'.split(
      ' ',
    ),
  ),
  es: new Set(
    'el los las que y es por una para con del como pero hola gracias está están somos usted ustedes nosotros muy también'.split(
      ' ',
    ),
  ),
  fr: new Set(
    'le les des et est une pour pas vous nous je il elle dans sur avec ce bonjour merci sont être très aussi'.split(
      ' ',
    ),
  ),
  de: new Set(
    'der die das und ist nicht ich sie wir ein eine zu mit den auf für es hallo danke sind auch sehr'.split(' '),
  ),
  pt: new Set(
    'os que é em um uma para com não você nós do da por olá obrigado obrigada são está muito também'.split(' '),
  ),
  it: new Set(
    'il lo gli di che è un una per con non sono noi voi del della ciao grazie anche molto questo'.split(' '),
  ),
}

/** Best-guess Latin-script language from common words; null when unclear. */
export function detectLatinCaptionLang(text: string): string | null {
  const words = text.toLowerCase().match(/[a-zà-öø-ÿ']+/g) ?? []
  if (!words.length) return null
  let best: string | null = null
  let bestScore = 0
  let tied = false
  for (const [lang, stopwords] of Object.entries(LATIN_STOPWORDS)) {
    const score = words.reduce((total, word) => total + (stopwords.has(word) ? 1 : 0), 0)
    if (score > bestScore) {
      best = lang
      bestScore = score
      tied = false
    } else if (score > 0 && score === bestScore) {
      tied = true
    }
  }
  return bestScore > 0 && !tied ? best : null
}

/** Heuristic: does this caption already look like the viewer's target language? */
export function captionLooksLikeTargetLang(text: string, targetLang: string): boolean {
  const base = baseLang(targetLang) || 'en'
  const hasLatin = /[A-Za-z]{2,}/.test(text)
  const hasDevanagari = /[\u0900-\u097F]/.test(text)
  const hasBengali = /[\u0980-\u09FF]/.test(text)
  const hasGurmukhi = /[\u0A00-\u0A7F]/.test(text)
  const hasGujarati = /[\u0A80-\u0AFF]/.test(text)
  const hasOriya = /[\u0B00-\u0B7F]/.test(text)
  const hasTamil = /[\u0B80-\u0BFF]/.test(text)
  const hasTelugu = /[\u0C00-\u0C7F]/.test(text)
  const hasKannada = /[\u0C80-\u0CFF]/.test(text)
  const hasMalayalam = /[\u0D00-\u0D7F]/.test(text)
  const hasSinhala = /[\u0D80-\u0DFF]/.test(text)
  const hasArabic = /[\u0600-\u06FF]/.test(text)
  const hasCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text)

  const indicScriptByLang: Record<string, boolean> = {
    hi: hasDevanagari,
    mr: hasDevanagari,
    ne: hasDevanagari,
    bn: hasBengali,
    gu: hasGujarati,
    pa: hasGurmukhi,
    or: hasOriya,
    ta: hasTamil,
    te: hasTelugu,
    kn: hasKannada,
    ml: hasMalayalam,
    si: hasSinhala,
  }
  if (base in indicScriptByLang) return !!indicScriptByLang[base]
  if (INDIC_LANGS.has(base)) return hasDevanagari || hasBengali || hasTamil || hasTelugu
  if (base === 'ar' || base === 'ur' || base === 'fa') return hasArabic
  if (base === 'zh' || base === 'ja' || base === 'ko') return hasCjk
  if (['en', 'es', 'fr', 'de', 'pt', 'it'].includes(base)) {
    if ((hasDevanagari || hasCjk || hasArabic || hasTamil || hasTelugu) && !hasLatin) return false
    const detected = detectLatinCaptionLang(text)
    if (detected && detected !== base) return false
    return hasLatin || !hasDevanagari
  }
  return true
}

/**
 * Choose live overlay text for the viewer's Show language.
 * Prefer translated text when available; fall back to original so the overlay
 * never blanks when translation fails or script heuristics miss.
 */
export function resolveLiveCaptionDisplay(input: {
  targetLang: string
  localInterimRaw?: string | null
  localInterimTranslated?: string | null
  lastGoodLocalTranslated?: string | null
  remoteInterimText?: string | null
  remoteInterimTranslated?: boolean | null
  fallbackFinalText?: string | null
}): string {
  const target = input.targetLang
  const raw = (input.localInterimRaw || '').trim()
  const translated = (input.localInterimTranslated || '').trim()
  const lastGood = (input.lastGoodLocalTranslated || '').trim()

  if (raw) {
    if (captionLooksLikeTargetLang(raw, target)) {
      return translated || raw
    }
    // Keep showing something while translation catches up / fails.
    return translated || lastGood || raw
  }

  const remote = (input.remoteInterimText || '').trim()
  if (remote) {
    if (
      captionLooksLikeTargetLang(remote, target) ||
      input.remoteInterimTranslated === true
    ) {
      return remote
    }
    return (input.fallbackFinalText || '').trim() || remote
  }

  return (input.fallbackFinalText || '').trim()
}

/**
 * Localize a caption line into the viewer's selected language.
 *
 * Always auto-detects the spoken language. Publishers used to tag captions with
 * the device region language, which skipped translation when someone spoke a
 * different language (e.g. English speech labeled as Hindi).
 */
export async function localizeCaptionLine(
  line: LiveCaptionLine,
  targetLang: string,
): Promise<LiveCaptionLine> {
  const original = (line.originalText || line.text).trim()
  const target = baseLang(targetLang) || 'en'
  if (!original) return { ...line, targetLang: target }

  if (captionLooksLikeTargetLang(original, target)) {
    return {
      ...line,
      originalText: original,
      text: original,
      targetLang: target,
      translated: false,
    }
  }

  const result = await translateCaptionText({
    text: original,
    targetLang: target,
    sourceLang: 'auto',
  })

  const translatedText = result.translatedText.trim() || original
  const detected = result.detectedSourceLang || line.sourceLang || null
  const changed = translatedText !== original && !result.skipped

  return {
    ...line,
    originalText: original,
    text: translatedText,
    sourceLang: detected,
    targetLang: target,
    // Only mark translated when the visible text actually changed.
    translated: changed,
  }
}

const cache = new Map<string, TranslateTextResult>()
const inflight = new Map<string, Promise<TranslateTextResult>>()

function cacheKey(text: string, targetLang: string, sourceLang: string) {
  return `${targetLang}::${sourceLang}::${text}`
}

/** Normalize region language codes for SpeechRecognition / BCP-47 tags. */
export function speechRecognitionLocale(languageCode: string, countryCode?: string): string {
  const fromTable = languageLocale(languageCode)
  if (fromTable) return fromTable
  const country = (countryCode || 'US').toUpperCase()
  return `${languageCode}-${country}`
}

export function captionLanguageName(languageCode: string): string {
  return languageLabel(languageCode) || languageCode.toUpperCase()
}

/**
 * Translate meeting caption text into the viewer's preferred language.
 * Cross-platform (web, Android, and iOS) via SHERPA. The original caption stays when there is no translation.
 */
export async function translateCaptionText(input: {
  text: string
  targetLang: string
  sourceLang?: string | null
}): Promise<TranslateTextResult> {
  const text = input.text.trim()
  const targetLang = (input.targetLang || 'en').trim().toLowerCase()
  const sourceLang = (input.sourceLang || 'auto').trim().toLowerCase() || 'auto'

  if (!text) {
    return {
      text,
      translatedText: text,
      detectedSourceLang: null,
      targetLang,
      usedFallback: false,
      skipped: true,
    }
  }

  if (captionLooksLikeTargetLang(text, targetLang) && sourceLang !== 'auto') {
    const same = baseLang(sourceLang) === baseLang(targetLang)
    if (same) {
      return {
        text,
        translatedText: text,
        detectedSourceLang: baseLang(sourceLang),
        targetLang,
        usedFallback: false,
        skipped: true,
      }
    }
  }

  const key = cacheKey(text, targetLang, sourceLang)
  const hit = cache.get(key)
  if (hit) return hit

  const pending = inflight.get(key)
  if (pending) return pending

  const request = (async () => {
    try {
      const payload = await invokeOwnedAssist<Partial<TranslateTextResult>>({
        action: 'translate',
        product: 'cowork',
        message: text,
        context: {
          target_lang: targetLang,
          source_lang: sourceLang,
          target_label: captionLanguageName(targetLang),
        },
      })
      if (!payload) throw new Error('SHERPA is unavailable right now.')
      const translated =
        typeof payload?.translatedText === 'string' && payload.translatedText.trim()
          ? payload.translatedText.trim()
          : text

      const looksTranslated =
        captionLooksLikeTargetLang(translated, targetLang) ||
        (translated !== text && Boolean(payload?.skipped))

      const result: TranslateTextResult = {
        text,
        translatedText: translated,
        detectedSourceLang:
          typeof payload?.detectedSourceLang === 'string' ? payload.detectedSourceLang : null,
        targetLang,
        usedFallback: Boolean(payload?.usedFallback) || (!looksTranslated && translated === text),
        skipped: Boolean(payload?.skipped),
      }

      // Do not cache failed echoes — retry on the next caption tick.
      const shouldCache =
        !result.usedFallback &&
        (result.translatedText !== text || captionLooksLikeTargetLang(result.translatedText, targetLang))
      if (shouldCache) {
        cache.set(key, result)
        if (cache.size > 200) {
          const first = cache.keys().next().value
          if (first) cache.delete(first)
        }
      }
      return result
    } catch {
      const fallback: TranslateTextResult = {
        text,
        translatedText: text,
        detectedSourceLang: null,
        targetLang,
        usedFallback: true,
      }
      return fallback
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, request)
  return request
}
