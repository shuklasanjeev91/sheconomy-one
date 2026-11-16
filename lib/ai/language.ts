import { languageLabel, languageLocale } from '~/lib/locale/region-data'

export type AiLanguagePrefs = {
  languageCode: string
  languageLabel: string
  localeTag: string
  countryCode: string
}

const DEFAULT_PREFS: AiLanguagePrefs = {
  languageCode: 'en',
  languageLabel: 'English',
  localeTag: 'en-US',
  countryCode: 'IN',
}

let current: AiLanguagePrefs = { ...DEFAULT_PREFS }

/** Keep SHERPA requests aligned with Region Preferences (app-wide). */
export function setAiLanguagePrefs(input: {
  languageCode?: string | null
  countryCode?: string | null
  localeTag?: string | null
}) {
  const languageCode = (input.languageCode || 'en').trim().toLowerCase() || 'en'
  const countryCode = (input.countryCode || 'IN').trim().toUpperCase() || 'IN'
  current = {
    languageCode,
    languageLabel: languageLabel(languageCode),
    localeTag: (input.localeTag || languageLocale(languageCode)).trim() || languageLocale(languageCode),
    countryCode,
  }
}

export function getAiLanguagePrefs(): AiLanguagePrefs {
  return current
}

/** Fields merged into every SHERPA `context` so the model replies in-language. */
export function aiLanguageContextFields(
  prefs: AiLanguagePrefs = current,
): Record<string, string> {
  return {
    preferred_language: prefs.languageCode,
    language_label: prefs.languageLabel,
    locale: prefs.localeTag,
    country_code: prefs.countryCode,
  }
}

/** Merge language into an assist request body (top-level + context). */
export function withAiLanguage(body: Record<string, unknown>): Record<string, unknown> {
  const prefs = getAiLanguagePrefs()
  const existing =
    body.context && typeof body.context === 'object' && !Array.isArray(body.context)
      ? (body.context as Record<string, unknown>)
      : {}
  return {
    ...body,
    language: prefs.languageCode,
    locale: prefs.localeTag,
    context: {
      ...aiLanguageContextFields(prefs),
      ...existing,
      // Prefer live prefs unless the caller explicitly overrode language.
      preferred_language:
        typeof existing.preferred_language === 'string' && existing.preferred_language.trim()
          ? String(existing.preferred_language).trim().toLowerCase()
          : prefs.languageCode,
      language_label:
        typeof existing.language_label === 'string' && existing.language_label.trim()
          ? String(existing.language_label).trim()
          : prefs.languageLabel,
      locale:
        typeof existing.locale === 'string' && existing.locale.trim()
          ? String(existing.locale).trim()
          : prefs.localeTag,
      country_code:
        typeof existing.country_code === 'string' && existing.country_code.trim()
          ? String(existing.country_code).trim().toUpperCase()
          : prefs.countryCode,
    },
  }
}
