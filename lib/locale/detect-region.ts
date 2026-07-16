import { Platform } from 'react-native'

import { inferCountryFromLocale } from '~/commerce/lib/infer-country-from-locale'
import { defaultCurrencyForCountry } from '~/lib/locale/region-data'
import { getDefaultCountryCode } from '~/lib/geo/data'

export type DetectedRegion = {
  countryCode: string
  languageCode: string
  currencyCode: string
  localeTag: string
}

async function detectLanguageCode(): Promise<string> {
  try {
    if (Platform.OS !== 'web') {
      const Localization = await import('expo-localization')
      const code = Localization.getLocales()?.[0]?.languageCode
      if (code) return code.toLowerCase().slice(0, 8)
    }
  } catch {
    // fall through
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.split('-')[0]?.toLowerCase() || 'en'
  }
  return 'en'
}

function detectLocaleTag(languageCode: string, countryCode: string): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale
    if (resolved) return resolved
  } catch {
    // ignore
  }
  return `${languageCode}-${countryCode}`
}

/**
 * Auto-detect browsing country, language, and currency from device / browser.
 * Soft defaults to India/INR when locale cannot be resolved (product home market).
 */
export async function detectDeviceRegion(): Promise<DetectedRegion> {
  const countryCode = (inferCountryFromLocale() || getDefaultCountryCode()).toUpperCase()
  const languageCode = await detectLanguageCode()
  const currencyCode = defaultCurrencyForCountry(countryCode)
  return {
    countryCode,
    languageCode,
    currencyCode,
    localeTag: detectLocaleTag(languageCode, countryCode),
  }
}
