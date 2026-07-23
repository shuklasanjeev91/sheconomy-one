import { getExchangeRatesVersion, subscribeExchangeRates } from '~/lib/currency/rates-store'

type DisplayCurrencyState = {
  preferredCurrency: string
  locale: string
  /** When false, formatters keep the source currency (vendor/admin edit forms). */
  convertEnabled: boolean
}

let state: DisplayCurrencyState = {
  preferredCurrency: 'INR',
  locale: 'en-IN',
  convertEnabled: true,
}

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

export function setDisplayCurrencyPreferences(next: Partial<DisplayCurrencyState>) {
  state = {
    preferredCurrency: (next.preferredCurrency ?? state.preferredCurrency).toUpperCase(),
    locale: next.locale ?? state.locale,
    convertEnabled: next.convertEnabled ?? state.convertEnabled,
  }
  notify()
}

export function getDisplayCurrencyPreferences(): DisplayCurrencyState {
  return state
}

export function subscribeDisplayCurrency(listener: () => void) {
  listeners.add(listener)
  const unsubscribeRates = subscribeExchangeRates(listener)
  return () => {
    listeners.delete(listener)
    unsubscribeRates()
  }
}

/** Combined snapshot so React re-renders when prefs or rates change. */
export function getDisplayCurrencySnapshot() {
  const prefs = state
  return `${prefs.preferredCurrency}|${prefs.locale}|${prefs.convertEnabled}|${getExchangeRatesVersion()}`
}
