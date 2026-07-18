import { useCallback, useSyncExternalStore } from 'react'

import {
  getDisplayCurrencySnapshot,
  subscribeDisplayCurrency,
} from '~/lib/currency/display-currency'
import {
  convertCurrencyAmount,
  roundConvertedAmount,
} from '~/lib/currency/exchange-rate-math'
import { getExchangeRateTable } from '~/lib/currency/rates-store'
import { formatCurrency as formatCurrencyBase } from '~/lib/format'
import { languageLocale } from '~/lib/locale/region-data'
import { useOptionalRegionPreferences } from '~/lib/locale/RegionPreferencesContext'

/**
 * Money formatter that converts listing/shop amounts into the shopper's
 * preferred currency (ExchangeRate-API) and formats with their locale.
 */
export function useFormatCurrency() {
  useSyncExternalStore(subscribeDisplayCurrency, getDisplayCurrencySnapshot, getDisplayCurrencySnapshot)

  const prefs = useOptionalRegionPreferences()
  const locale = prefs ? languageLocale(prefs.languageCode) : 'en-IN'
  const preferredCurrency = prefs?.currencyCode ?? 'INR'

  const formatMoney = useCallback(
    (amount: number, sourceCurrency?: string | null, options?: { convert?: boolean }) =>
      formatCurrencyBase(amount, sourceCurrency?.trim() || preferredCurrency, locale, {
        convert: options?.convert,
        displayCurrency: preferredCurrency,
      }),
    [locale, preferredCurrency],
  )

  const convertMoney = useCallback(
    (amount: number, sourceCurrency?: string | null) => {
      const source = (sourceCurrency?.trim() || preferredCurrency).toUpperCase()
      if (source === preferredCurrency) return amount
      const converted = convertCurrencyAmount(amount, source, preferredCurrency, getExchangeRateTable())
      if (converted == null) return amount
      return roundConvertedAmount(converted, preferredCurrency)
    },
    [preferredCurrency],
  )

  return {
    formatMoney,
    convertMoney,
    preferredCurrency,
    locale,
    countryCode: prefs?.countryCode ?? 'IN',
  }
}
