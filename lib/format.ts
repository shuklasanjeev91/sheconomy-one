import {
  getDisplayCurrencyPreferences,
} from '~/lib/currency/display-currency'
import {
  convertCurrencyAmount,
  roundConvertedAmount,
} from '~/lib/currency/exchange-rate-math'
import { getExchangeRateTable } from '~/lib/currency/rates-store'
import { CURRENCY_SYMBOLS, DEFAULT_SHOP_CURRENCY } from '~/lib/shop/shop.type'

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateCardTitle(value: string, max = 72): string {
  const clean = value.trim()
  if (clean.length <= max) return clean

  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function cleanSeoTitle(value: string): string {
  return value
    .replace(/^(Order|Buy|Shop)\s+/i, '')
    .replace(/\s+Online$/i, '')
    .trim()
}

function isDescriptionLikeTitle(title: string): boolean {
  if (title.length > 80) return true
  if (/^(This|The|A|An)\s+[a-z]/i.test(title)) return true
  return title.includes(' for ') && title.length > 50
}

function titleFromDescription(description: string): string | null {
  const desc = stripHtml(description)
  if (!desc) return null

  const titled = desc.match(/^Title\s*:\s*(.+?)(?:\s*\||\n|$)/i)?.[1]?.trim()
  if (titled) return titled

  const productName = desc.match(/Product Name\s*:\s*(.+?)(?:\n|$)/i)?.[1]?.trim()
  if (productName) return productName

  return null
}

/** Short product name for listing tiles — never the full marketing description. */
export function getListingCardTitle(listing: {
  title: string
  meta_title?: string | null
  description?: string | null
}): string {
  const rawTitle = stripHtml(listing.title ?? '')
  const titleCandidate = truncateCardTitle(
    rawTitle.split('|')[0]?.split(/\r?\n/)[0]?.trim() || rawTitle,
  )

  const metaCandidate = cleanSeoTitle(stripHtml(listing.meta_title ?? ''))

  if (titleCandidate && !isDescriptionLikeTitle(rawTitle)) {
    return titleCandidate
  }

  if (metaCandidate) {
    return truncateCardTitle(metaCandidate)
  }

  if (titleCandidate) {
    return titleCandidate
  }

  const fromDescription = titleFromDescription(listing.description ?? '')
  if (fromDescription) {
    return truncateCardTitle(fromDescription)
  }

  return 'Listing'
}

export type FormatCurrencyOptions = {
  /** When false, skip FX conversion and format in the source currency. Default true. */
  convert?: boolean
  /** Override the shopper preferred display currency. */
  displayCurrency?: string | null
}

function formatCurrencyValue(amount: number, currency: string, locale: string) {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: safeAmount % 1 === 0 ? 0 : 2,
    }).format(safeAmount)
  } catch {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: safeAmount % 1 === 0 ? 0 : 2,
    }).format(safeAmount)
  }
}

/**
 * Format a money amount for display. By default the amount (in `currency`) is
 * converted into the shopper's preferred currency via ExchangeRate-API rates.
 * Pass `{ convert: false }` for vendor/admin edit surfaces that must stay in
 * the listing/shop currency.
 */
export function formatCurrency(
  amount: number,
  currency = 'INR',
  locale?: string,
  options?: FormatCurrencyOptions,
) {
  const prefs = getDisplayCurrencyPreferences()
  const source = (currency || 'INR').trim().toUpperCase() || 'INR'
  const shouldConvert = options?.convert !== false && prefs.convertEnabled
  const display =
    (options?.displayCurrency?.trim() || prefs.preferredCurrency || source).toUpperCase()
  const resolvedLocale = locale || prefs.locale || 'en-IN'

  if (!shouldConvert || display === source) {
    return formatCurrencyValue(amount, source, resolvedLocale)
  }

  const converted = convertCurrencyAmount(amount, source, display, getExchangeRateTable())
  if (converted == null) {
    return formatCurrencyValue(amount, source, resolvedLocale)
  }
  return formatCurrencyValue(roundConvertedAmount(converted, display), display, resolvedLocale)
}

/** Shopper-facing price — always shows the currency symbol, never the ISO code. */
export function formatMoneyLabel(
  amount: number,
  currency = DEFAULT_SHOP_CURRENCY,
  locale?: string,
  options?: FormatCurrencyOptions,
) {
  const formatted = formatCurrency(amount, currency, locale, options)
  const code = (currency || DEFAULT_SHOP_CURRENCY).trim().toUpperCase()
  if (formatted.includes(code)) {
    const symbol = CURRENCY_SYMBOLS[code] ?? code
    return formatted.replace(code, symbol).replace(/\s{2,}/g, ' ').trim()
  }
  return formatted
}

export function formatRating(rating: number | string | null | undefined) {
  if (rating == null || rating === '') return '—'
  const value = Number(rating)
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(1)
}
