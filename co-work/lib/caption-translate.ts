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
      cache.set(key, result)
      if (cache.size > 200) {
        const first = cache.keys().next().value
        if (first) cache.delete(first)
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
