import { useEffect, useSyncExternalStore, type ReactNode } from 'react'

import {
  getDisplayCurrencySnapshot,
  setDisplayCurrencyPreferences,
  subscribeDisplayCurrency,
} from '~/lib/currency/display-currency'
import { ensureExchangeRatesLoaded } from '~/lib/currency/exchange-rates'
import { useOptionalRegionPreferences } from '~/lib/locale/RegionPreferencesContext'

/**
 * Keeps money formatters in sync with the shopper's preferred currency and
 * refreshes ExchangeRate-API tables for web + native.
 */
export function CurrencyRatesProvider({ children }: { children: ReactNode }) {
  const prefs = useOptionalRegionPreferences()

  useEffect(() => {
    if (!prefs) return
    setDisplayCurrencyPreferences({
      preferredCurrency: prefs.currencyCode,
      locale: prefs.localeTag,
      convertEnabled: true,
    })
  }, [prefs?.currencyCode, prefs?.localeTag, prefs])

  useEffect(() => {
    void ensureExchangeRatesLoaded()
    const timer = setInterval(
      () => {
        void ensureExchangeRatesLoaded()
      },
      1000 * 60 * 60 * 6,
    )
    return () => clearInterval(timer)
  }, [])

  // Re-render the tree when rates or preferred currency change so every
  // formatCurrency call during render picks up converted amounts.
  useSyncExternalStore(subscribeDisplayCurrency, getDisplayCurrencySnapshot, getDisplayCurrencySnapshot)

  return <>{children}</>
}
