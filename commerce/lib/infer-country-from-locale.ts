export function inferCountryFromLocale(): string | null {
  if (typeof navigator === 'undefined') return null
  const locale = navigator.language || ''
  const match = locale.match(/-([A-Z]{2})$/i)
  return match ? match[1].toUpperCase() : null
}
