import type { CartItemRow, CartRow } from '~/commerce/lib/cart'
import { isPhysicalListing } from '~/commerce/lib/listing-fulfillment'
import {
  calculateShippingCharge,
  calculateEstimatedDeliveryDate,
} from '~/lib/shipping-policy/shipping-policy.utils'
import type { ShippingPolicy } from '~/lib/shipping-policy/shipping-policy.type'
import { supabase } from '~/lib/supabase/client'

export type ShopShippingQuote = {
  shopId: string
  shopSubtotal: number
  shopDiscount: number
  subtotalAfterDiscount: number
  shippingAmount: number
  isFreeShipping: boolean
  requiresShipping: boolean
  deliveryProfileId: string | null
  deliveryProfileName: string | null
  estimatedDays: number
  estimatedDeliveryDate: string
}

export type CheckoutShippingQuote = {
  byShop: ShopShippingQuote[]
  shippingTotal: number
  itemsTotal: number
  grandTotal: number
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function shopDiscountShare(shopSubtotal: number, selectedSubtotal: number, cartDiscount: number) {
  if (selectedSubtotal <= 0 || cartDiscount <= 0) return 0
  return round2((cartDiscount * shopSubtotal) / selectedSubtotal)
}

function shopRequiresShipping(
  items: CartItemRow[],
  listingTypes: Map<string, string>,
): boolean {
  return items.some((item) => isPhysicalListing(listingTypes.get(item.listing_id)))
}

export async function fetchDeliveryProfilesByShopIds(
  shopIds: string[],
): Promise<Map<string, ShippingPolicy[]>> {
  const unique = [...new Set(shopIds.filter(Boolean))]
  const map = new Map<string, ShippingPolicy[]>()
  if (!unique.length) return map

  const { data, error } = await supabase
    .from('delivery_profiles')
    .select('*')
    .in('shop_id', unique)
    .eq('is_active', true)

  if (error) throw new Error(error.message)

  for (const row of (data ?? []) as ShippingPolicy[]) {
    const list = map.get(row.shop_id) ?? []
    list.push(row)
    map.set(row.shop_id, list)
  }

  return map
}

/** Client-side preview — server recomputes the same rules in atomic_marketplace_checkout. */
export function computeCheckoutShippingQuote(input: {
  cart: CartRow | null
  selectedItems: CartItemRow[]
  listingTypes: Map<string, string>
  deliveryProfilesByShop: Map<string, ShippingPolicy[]>
  selectedSubtotal: number
  selectedDiscount: number
}): CheckoutShippingQuote {
  const shopIds = [...new Set(input.selectedItems.map((item) => item.shop_id))]
  const byShop: ShopShippingQuote[] = []
  let shippingTotal = 0

  for (const shopId of shopIds) {
    const shopItems = input.selectedItems.filter((item) => item.shop_id === shopId)
    const shopSubtotal = shopItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
    const shopDiscount = shopDiscountShare(
      shopSubtotal,
      input.selectedSubtotal,
      input.selectedDiscount,
    )
    const subtotalAfterDiscount = Math.max(0, round2(shopSubtotal - shopDiscount))
    const requiresShipping = shopRequiresShipping(shopItems, input.listingTypes)

    let shippingAmount = 0
    let isFreeShipping = true
    let deliveryProfileId: string | null = null
    let deliveryProfileName: string | null = null
    let estimatedDays = 7

    if (requiresShipping) {
      const charge = calculateShippingCharge(
        input.deliveryProfilesByShop.get(shopId) ?? [],
        subtotalAfterDiscount,
      )
      shippingAmount = charge.shippingAmount
      isFreeShipping = charge.isFreeShipping
      deliveryProfileId = charge.deliveryProfile?.id ?? null
      deliveryProfileName = charge.deliveryProfile?.profile_name ?? null
      estimatedDays = charge.estimatedDays
    }

    shippingTotal += shippingAmount
    byShop.push({
      shopId,
      shopSubtotal: round2(shopSubtotal),
      shopDiscount,
      subtotalAfterDiscount,
      shippingAmount,
      isFreeShipping,
      requiresShipping,
      deliveryProfileId,
      deliveryProfileName,
      estimatedDays,
      estimatedDeliveryDate: calculateEstimatedDeliveryDate(estimatedDays)
        .toISOString()
        .slice(0, 10),
    })
  }

  const itemsTotal = Math.max(0, round2(input.selectedSubtotal - input.selectedDiscount))
  return {
    byShop,
    shippingTotal: round2(shippingTotal),
    itemsTotal,
    grandTotal: round2(itemsTotal + shippingTotal),
  }
}
