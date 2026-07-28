import type { CartItemRow } from '~/commerce/lib/cart'
import type { CheckoutShippingQuote } from '~/commerce/lib/checkout-shipping'

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function shopCurrencyFor(
  shopId: string,
  shopCurrencies: Map<string, string>,
  fallback = 'INR',
): string {
  return shopCurrencies.get(shopId)?.trim().toUpperCase() || fallback
}

export function convertCartLineTotal(
  item: CartItemRow,
  shopCurrencies: Map<string, string>,
  convertMoney: (amount: number, sourceCurrency?: string | null) => number,
  fallback = 'INR',
): number {
  return convertMoney(
    item.unit_price * item.quantity,
    shopCurrencyFor(item.shop_id, shopCurrencies, fallback),
  )
}

export function computeShopDisplaySubtotal(
  shopItems: CartItemRow[],
  shopCurrencies: Map<string, string>,
  convertMoney: (amount: number, sourceCurrency?: string | null) => number,
  fallback = 'INR',
): number {
  return round2(
    shopItems.reduce(
      (sum, item) => sum + convertCartLineTotal(item, shopCurrencies, convertMoney, fallback),
      0,
    ),
  )
}

export function computeCheckoutDisplayTotals(input: {
  selectedItems: CartItemRow[]
  subtotal: number
  discount: number
  shippingQuote: CheckoutShippingQuote
  needsShipping: boolean
  shopCurrencies: Map<string, string>
  convertMoney: (amount: number, sourceCurrency?: string | null) => number
  settlementCurrency?: string
}) {
  const fallback = input.settlementCurrency ?? 'INR'

  const itemsSubtotal = round2(
    input.selectedItems.reduce(
      (sum, item) =>
        sum +
        convertCartLineTotal(item, input.shopCurrencies, input.convertMoney, fallback),
      0,
    ),
  )

  const discountRatio =
    input.subtotal > 0 && input.discount > 0 ? input.discount / input.subtotal : 0
  const promotion = round2(itemsSubtotal * discountRatio)

  const shipping = input.needsShipping
    ? round2(
        input.shippingQuote.byShop.reduce(
          (sum, shop) =>
            sum +
            input.convertMoney(
              shop.shippingAmount,
              shopCurrencyFor(shop.shopId, input.shopCurrencies, fallback),
            ),
          0,
        ),
      )
    : 0

  const orderTotal = round2(Math.max(0, itemsSubtotal - promotion) + shipping)

  return { itemsSubtotal, promotion, shipping, orderTotal }
}

export function computeCartDisplayTotals(input: {
  selectedItems: CartItemRow[]
  subtotal: number
  discount: number
  shopCurrencies: Map<string, string>
  convertMoney: (amount: number, sourceCurrency?: string | null) => number
  settlementCurrency?: string
}) {
  const fallback = input.settlementCurrency ?? 'INR'

  const itemsSubtotal = round2(
    input.selectedItems.reduce(
      (sum, item) =>
        sum +
        convertCartLineTotal(item, input.shopCurrencies, input.convertMoney, fallback),
      0,
    ),
  )

  const discountRatio =
    input.subtotal > 0 && input.discount > 0 ? input.discount / input.subtotal : 0
  const promotion = round2(itemsSubtotal * discountRatio)
  const total = round2(Math.max(0, itemsSubtotal - promotion))

  return { itemsSubtotal, promotion, total }
}

export type ShopCustomerOrderAmounts = {
  subtotal_amount: number
  shipping_amount: number
  discount_amount: number
  total_amount: number
}

/** Converted per-shop totals shown to the shopper at checkout (customer currency). */
export function computeShopCustomerOrderAmounts(input: {
  shopId: string
  shopItems: CartItemRow[]
  cartSubtotal: number
  cartDiscount: number
  shippingAmount: number
  shopCurrencies: Map<string, string>
  convertMoney: (amount: number, sourceCurrency?: string | null) => number
  settlementCurrency?: string
}): ShopCustomerOrderAmounts {
  const fallback = input.settlementCurrency ?? 'INR'
  const shopCurrency = shopCurrencyFor(input.shopId, input.shopCurrencies, fallback)
  const shopDisplaySubtotal = computeShopDisplaySubtotal(
    input.shopItems,
    input.shopCurrencies,
    input.convertMoney,
    fallback,
  )
  const discountRatio =
    input.cartSubtotal > 0 && input.cartDiscount > 0
      ? input.cartDiscount / input.cartSubtotal
      : 0
  const shopDisplayDiscount = round2(shopDisplaySubtotal * discountRatio)
  const shopDisplayShipping = round2(input.convertMoney(input.shippingAmount, shopCurrency))
  const shopDisplayTotal = round2(
    Math.max(0, shopDisplaySubtotal - shopDisplayDiscount) + shopDisplayShipping,
  )

  return {
    subtotal_amount: shopDisplaySubtotal,
    shipping_amount: shopDisplayShipping,
    discount_amount: shopDisplayDiscount,
    total_amount: shopDisplayTotal,
  }
}

export function buildCustomerAmountsByShop(input: {
  selectedItems: CartItemRow[]
  subtotal: number
  discount: number
  shippingQuote: CheckoutShippingQuote
  shopCurrencies: Map<string, string>
  convertMoney: (amount: number, sourceCurrency?: string | null) => number
  settlementCurrency?: string
}): Record<string, ShopCustomerOrderAmounts> {
  const byShop = new Map<string, CartItemRow[]>()
  for (const item of input.selectedItems) {
    const rows = byShop.get(item.shop_id) ?? []
    rows.push(item)
    byShop.set(item.shop_id, rows)
  }

  const amounts: Record<string, ShopCustomerOrderAmounts> = {}
  for (const [shopId, shopItems] of byShop) {
    const shippingRow = input.shippingQuote.byShop.find((shop) => shop.shopId === shopId)
    amounts[shopId] = computeShopCustomerOrderAmounts({
      shopId,
      shopItems,
      cartSubtotal: input.subtotal,
      cartDiscount: input.discount,
      shippingAmount: shippingRow?.shippingAmount ?? 0,
      shopCurrencies: input.shopCurrencies,
      convertMoney: input.convertMoney,
      settlementCurrency: input.settlementCurrency,
    })
  }
  return amounts
}
