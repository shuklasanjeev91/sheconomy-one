import type { LiveCaptionLine } from '~/co-work/lib/live-captions'
import { supabase } from '~/lib/supabase'
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

/** Heuristic: does this caption already look like the viewer's target language? */
export function captionLooksLikeTargetLang(text: string, targetLang: string): boolean {
  const base = baseLang(targetLang) || 'en'
  const hasLatin = /[A-Za-z]{2,}/.test(text)
  const hasDevanagari = /[\u0900-\u097F]/.test(text)
  const hasArabic = /[\u0600-\u06FF]/.test(text)
  const hasCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text)
  // Indic targets: only treat as already-localized when Devanagari (or similar) is present.
  // Do not treat "no Latin" as Hindi — that wrongly skipped English→Hindi translation.
  if (INDIC_LANGS.has(base)) return hasDevanagari
  if (base === 'ar' || base === 'ur' || base === 'fa') return hasArabic
  if (base === 'zh' || base === 'ja' || base === 'ko') return hasCjk
  if (['en', 'es', 'fr', 'de', 'pt', 'it'].includes(base)) {
    if ((hasDevanagari || hasCjk || hasArabic) && !hasLatin) return false
    return hasLatin || !hasDevanagari
  }
  return true
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
 * Cross-platform (web / iOS / Android) via ai-assist edge function.
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
      const { data, error } = await supabase.functions.invoke('ai-assist', {
        body: {
          action: 'translate',
          product: 'cowork',
          message: text,
          context: {
            target_lang: targetLang,
            source_lang: sourceLang,
            target_label: captionLanguageName(targetLang),
          },
        },
      })

      if (error) throw error

      const payload = data as Partial<TranslateTextResult> | null
      const translated =
        typeof payload?.translatedText === 'string' && payload.translatedText.trim()
          ? payload.translatedText.trim()
          : text

      const result: TranslateTextResult = {
        text,
        translatedText: translated,
        detectedSourceLang:
          typeof payload?.detectedSourceLang === 'string' ? payload.detectedSourceLang : null,
        targetLang,
        usedFallback: Boolean(payload?.usedFallback),
        skipped: Boolean(payload?.skipped),
      }

      // Do not cache failed echoes — retry on the next caption tick.
      const shouldCache =
        !result.usedFallback ||
        result.translatedText !== text ||
        captionLooksLikeTargetLang(result.translatedText, targetLang)
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
