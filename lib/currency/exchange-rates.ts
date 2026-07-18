import { peekAppCache, readAppCache, writeAppCache } from '~/lib/cache/app-cache'
import {
  convertCurrencyAmount,
  normalizeCurrencyCode,
  roundConvertedAmount,
  type ExchangeRateTable,
} from '~/lib/currency/exchange-rate-math'
import {
  getExchangeRateTable,
  getExchangeRatesVersion,
  setExchangeRateTableMemory,
  seedExchangeRatesForTests,
  subscribeExchangeRates,
} from '~/lib/currency/rates-store'
import { supabase } from '~/lib/supabase/client'

export type { ExchangeRateTable }
export {
  convertCurrencyAmount,
  normalizeCurrencyCode,
  roundConvertedAmount,
  getExchangeRateTable,
  getExchangeRatesVersion,
  seedExchangeRatesForTests,
  subscribeExchangeRates,
}

const CACHE_KEY = 'exchange-rates:v1'
/** Refresh at most once per 12h client-side (provider free tier is daily). */
export const EXCHANGE_RATES_TTL_MS = 1000 * 60 * 60 * 12

let loadPromise: Promise<ExchangeRateTable | null> | null = null

function isFresh(table: ExchangeRateTable, now = Date.now()) {
  if (table.nextUpdateAt && now < table.nextUpdateAt) return true
  return now - table.fetchedAt < EXCHANGE_RATES_TTL_MS
}

function setTable(table: ExchangeRateTable) {
  setExchangeRateTableMemory(table)
  void writeAppCache(CACHE_KEY, table)
}

type EdgeRatesPayload = {
  base?: string
  rates?: Record<string, number>
  fetchedAt?: number
  nextUpdateAt?: number | null
  error?: string
  unavailable?: boolean
}

/** Fetch latest rates via the Supabase edge function (API key stays server-side). */
async function fetchLatestRates(base: string): Promise<ExchangeRateTable> {
  const baseCode = normalizeCurrencyCode(base)
  const { data, error } = await supabase.functions.invoke('exchange-rates', {
    body: { base: baseCode },
  })

  if (error) {
    throw new Error(error.message || 'Exchange rate edge function failed')
  }

  const payload = (data ?? {}) as EdgeRatesPayload
  if (payload.error || !payload.rates || typeof payload.rates !== 'object') {
    throw new Error(payload.error || 'Exchange rate payload missing rates')
  }

  return {
    base: normalizeCurrencyCode(payload.base ?? baseCode),
    rates: payload.rates,
    fetchedAt: typeof payload.fetchedAt === 'number' ? payload.fetchedAt : Date.now(),
    nextUpdateAt: typeof payload.nextUpdateAt === 'number' ? payload.nextUpdateAt : null,
  }
}

/**
 * Ensure a fresh rate table is in memory (and disk cache). Safe to call often.
 * Uses USD as the table base so any pair can be converted.
 */
export async function ensureExchangeRatesLoaded(force = false): Promise<ExchangeRateTable | null> {
  const existing = getExchangeRateTable() ?? peekAppCache<ExchangeRateTable>(CACHE_KEY)
  if (!force && existing && isFresh(existing)) {
    if (!getExchangeRateTable()) setExchangeRateTableMemory(existing)
    return existing
  }

  if (!force && loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const cached = existing ?? (await readAppCache<ExchangeRateTable>(CACHE_KEY))
      if (!force && cached && isFresh(cached)) {
        setTable(cached)
        return cached
      }
      const fresh = await fetchLatestRates('USD')
      setTable(fresh)
      return fresh
    } catch {
      if (existing) {
        setExchangeRateTableMemory(existing)
        return existing
      }
      const stale = await readAppCache<ExchangeRateTable>(CACHE_KEY)
      if (stale) {
        setTable(stale)
        return stale
      }
      return null
    } finally {
      loadPromise = null
    }
  })()

  return loadPromise
}
