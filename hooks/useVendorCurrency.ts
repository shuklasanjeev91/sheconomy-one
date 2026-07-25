import { useMemo } from 'react'

import {
  getCurrentShopUtils,
  resolveVendorCurrency,
  type CurrentShopUtils,
  type VendorCurrencyInfo,
} from '~/lib/shop/current-shop-utils'
import { useAppSelector } from '~/lib/store/hooks'

export type UseVendorCurrencyResult = CurrentShopUtils & {
  /** Alias used by list UIs (old ProductList `currencyInfo` prop). */
  currencyInfo: VendorCurrencyInfo
  /**
   * Resolve display currency for a listing/order row.
   * Prefer listing/order override, then the active shop currency.
   */
  resolveCurrency: (...candidates: Array<string | null | undefined>) => string
}

/**
 * Global vendor-panel currency helper.
 *
 * Reads `s.shop.currentShop.shop_currency` and returns the same bundle the old
 * project built with `getCurrentShopUtils(currentShop)` — use this anywhere in
 * `/vendor/*` instead of hardcoding `INR` or reading the shop column ad hoc.
 *
 * @example
 * ```tsx
 * const { currency, currencyInfo, formatAmount, resolveCurrency } = useVendorCurrency()
 * // Product list:
 * //   currencyInfo={{ symbol, code, formatAmount }}
 * // Product detail:
 * //   const code = resolveCurrency(listing.shop_currency, listing.shop?.shop_currency)
 * ```
 */
export function useVendorCurrency(): UseVendorCurrencyResult {
  const shop = useAppSelector((state) => state.shop.currentShop)

  return useMemo(() => {
    const utils = getCurrentShopUtils(shop)
    return {
      ...utils,
      resolveCurrency: (...candidates) =>
        resolveVendorCurrency(...candidates, utils.currency),
    }
  }, [shop])
}
