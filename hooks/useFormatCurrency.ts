import { useCallback } from 'react'

import { formatCurrency as formatCurrencyBase } from '~/lib/format'
import { languageLocale } from '~/lib/locale/region-data'
import { useOptionalRegionPreferences } from '~/lib/locale/RegionPreferencesContext'

/**
 * Money formatter that respects the shopper's language + preferred currency when
 * a listing does not supply its own currency (or when formatting generic amounts).
 */
export function useFormatCurrency() {
  const prefs = useOptionalRegionPreferences()
  const locale = prefs ? languageLocale(prefs.languageCode) : 'en-IN'
  const preferredCurrency = prefs?.currencyCode ?? 'INR'

  const formatMoney = useCallback(
    (amount: number, currency?: string | null) =>
      formatCurrencyBase(amount, currency?.trim() || preferredCurrency, locale),
    [locale, preferredCurrency],
  )

  return {
    formatMoney,
    preferredCurrency,
    locale,
    countryCode: prefs?.countryCode ?? 'IN',
  }
}
