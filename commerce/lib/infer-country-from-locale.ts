export function inferCountryFromLocale(): string | null {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const match = navigator.language.match(/-([A-Z]{2})$/i)
    if (match) return match[1].toUpperCase()
  }

  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    const match = locale.match(/-([A-Z]{2})$/i)
    return match ? match[1].toUpperCase() : null
  } catch {
    return null
  }
}
