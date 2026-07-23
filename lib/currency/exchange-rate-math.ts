export type ExchangeRateTable = {
  base: string
  rates: Record<string, number>
  fetchedAt: number
  nextUpdateAt: number | null
}

export function normalizeCurrencyCode(code: string | null | undefined): string {
  const trimmed = (code ?? 'INR').trim().toUpperCase()
  return trimmed || 'INR'
}

/**
 * Convert an amount from one ISO currency to another using a rate table
 * (rates are quoted as units of each currency per 1 unit of `table.base`).
 */
export function convertCurrencyAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  table: ExchangeRateTable | null | undefined,
): number | null {
  if (!Number.isFinite(amount)) return null
  const from = normalizeCurrencyCode(fromCurrency)
  const to = normalizeCurrencyCode(toCurrency)
  if (from === to) return amount
  if (!table?.rates) return null

  const rates = table.rates
  const base = normalizeCurrencyCode(table.base)
  const fromRate = from === base ? 1 : rates[from]
  const toRate = to === base ? 1 : rates[to]
  if (fromRate == null || toRate == null || fromRate === 0) return null

  return (amount / fromRate) * toRate
}

export function roundConvertedAmount(amount: number, currency: string): number {
  const code = normalizeCurrencyCode(currency)
  if (['JPY', 'KRW', 'VND', 'CLP'].includes(code)) return Math.round(amount)
  return Math.round(amount * 100) / 100
}
