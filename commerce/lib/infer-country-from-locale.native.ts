import { getLocales } from 'expo-localization'

export function inferCountryFromLocale(): string | null {
  try {
    return getLocales()[0]?.regionCode ?? null
  } catch {
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale
      const match = locale.match(/-([A-Z]{2})$/i)
      return match ? match[1].toUpperCase() : null
    } catch {
      return null
    }
  }
}
