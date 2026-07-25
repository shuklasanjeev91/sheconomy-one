/**
 * Current shop currency utilities for the vendor panel.
 *
 * Source of truth: `shops.shop_currency` (see doc/shop/README.md).
 * Mirrors the old project's `lib/utils/currentShopUtils.js` pattern:
 * resolve currency from the active shop, then format every money display
 * with that code so listings / analytics / discounts stay consistent.
 */

import { formatCurrency as formatCurrencyIntl } from '~/lib/format'

import {
  CURRENCY_SYMBOLS,
  DEFAULT_SHOP_CURRENCY,
  SUPPORTED_CURRENCIES,
  type Shop,
} from './shop.type'

export type FormatVendorCurrencyOptions = {
  /** Include the currency symbol (default true). */
  showSymbol?: boolean
  /** Append the ISO code after the amount (default false). */
  showCode?: boolean
  /** Never convert into a shopper display currency (vendor panel default). */
  convert?: boolean
}

/** Shape passed into list/card UIs (same as old ProductList `currencyInfo`). */
export type VendorCurrencyInfo = {
  code: string
  symbol: string
  formatAmount: (
    amount: number | string | null | undefined,
    options?: FormatVendorCurrencyOptions,
  ) => string
}

export type CurrentShopUtils = {
  currency: string
  currencySymbol: string
  currencyInfo: VendorCurrencyInfo
  formatAmount: VendorCurrencyInfo['formatAmount']
  shopId: string | null
  shopName: string
  shopEmail: string
  shopPhone: string
  logoUrl: string
  websiteUrl: string
  isValid: boolean
}

/** Currency symbol for a code, falling back to the platform default. */
export function getCurrencySymbol(currencyCode: string | null | undefined): string {
  if (!currencyCode) return CURRENCY_SYMBOLS[DEFAULT_SHOP_CURRENCY]
  const upper = currencyCode.toUpperCase()
  return CURRENCY_SYMBOLS[upper] ?? currencyCode
}

/** Human name for a supported currency code. */
export function getCurrencyName(currencyCode: string | null | undefined): string {
  const fallback = 'Indian Rupee'
  if (!currencyCode) return fallback
  const match = SUPPORTED_CURRENCIES.find(
    (currency) => currency.code.toLowerCase() === currencyCode.toLowerCase(),
  )
  return match?.name ?? fallback
}

export function isValidCurrency(currencyCode: string | null | undefined): boolean {
  return (
    !!currencyCode &&
    Object.prototype.hasOwnProperty.call(CURRENCY_SYMBOLS, currencyCode.toUpperCase())
  )
}

/**
 * Resolve the vendor-facing currency code.
 * Prefer an explicit listing/order override, then the shop column, then default.
 */
export function resolveVendorCurrency(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const code = candidate?.trim()
    if (code) return code.toUpperCase()
  }
  return DEFAULT_SHOP_CURRENCY
}

/** Format an amount in a shop currency (no shopper FX conversion). */
export function formatShopCurrency(
  amount: number | string | null | undefined,
  currencyCode: string = DEFAULT_SHOP_CURRENCY,
  options: FormatVendorCurrencyOptions = {},
): string {
  const { showSymbol = true, showCode = false, convert = false } = options
  const numeric = typeof amount === 'number' ? amount : Number(amount ?? 0)
  const safeAmount = Number.isFinite(numeric) ? numeric : 0
  const code = resolveVendorCurrency(currencyCode)

  const formatted = formatCurrencyIntl(safeAmount, code, undefined, { convert })

  if (showSymbol && showCode) {
    return `${formatted} ${code}`
  }
  if (!showSymbol) {
    const symbol = getCurrencySymbol(code)
    return formatted.replace(symbol, '').trim()
  }
  if (showCode) {
    return `${formatted} ${code}`
  }
  return formatted
}

/** Form field labels / placeholders keyed off the shop currency. */
export function getCurrencyDisplayOptions(currencyCode: string | null | undefined) {
  const code = resolveVendorCurrency(currencyCode)
  const symbol = getCurrencySymbol(code)
  return {
    symbol,
    code,
    placeholder: '0.00',
    label: `Amount (${symbol})`,
    inputLabel: `(${symbol})`,
    displayText: `${symbol} ${code}`,
  }
}

/** Build the ProductList-style `currencyInfo` object for a currency code. */
export function toCurrencyInfo(currencyCode: string | null | undefined): VendorCurrencyInfo {
  const code = resolveVendorCurrency(currencyCode)
  const symbol = getCurrencySymbol(code)
  return {
    code,
    symbol,
    formatAmount: (amount, options) => formatShopCurrency(amount, code, options),
  }
}

/**
 * Derive currency + formatting helpers from the active vendor shop.
 * Pass `currentShop` from Redux (`s.shop.currentShop`) — same as the old store.
 */
export function getCurrentShopUtils(shop: Shop | null | undefined): CurrentShopUtils {
  if (!shop) {
    const currencyInfo = toCurrencyInfo(DEFAULT_SHOP_CURRENCY)
    return {
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      currencyInfo,
      formatAmount: currencyInfo.formatAmount,
      shopId: null,
      shopName: '',
      shopEmail: '',
      shopPhone: '',
      logoUrl: '',
      websiteUrl: '',
      isValid: false,
    }
  }

  const currency = resolveVendorCurrency(shop.shop_currency)
  const currencyInfo = toCurrencyInfo(currency)

  return {
    currency,
    currencySymbol: currencyInfo.symbol,
    currencyInfo,
    formatAmount: currencyInfo.formatAmount,
    shopId: shop.id ?? null,
    shopName: shop.shop_name ?? '',
    shopEmail: shop.shop_email ?? '',
    shopPhone: shop.shop_phone_number ?? '',
    logoUrl: shop.logo_url ?? '',
    websiteUrl: shop.website_url ?? '',
    isValid: true,
  }
}
