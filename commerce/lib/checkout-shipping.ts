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
  /** Easyship DDP breakdown (optional). */
  shipmentCharge?: number
  taxAmount?: number
  dutyAmount?: number
  handlingFee?: number
  isFreeShipping: boolean
  requiresShipping: boolean
  deliveryProfileId: string | null
  deliveryProfileName: string | null
  estimatedDays: number
  estimatedDeliveryDate: string
  courierName?: string | null
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

export type EasyshipDdpShopQuote = {
  shop_id: string
  shipment_charge: number
  tax_amount: number
  duty_amount: number
  handling_fee: number
  shipping_amount: number
  total_charge: number
  currency: string
  courier_service_id: string | null
  courier_name: string | null
  estimated_days: number
}

/** Live Easyship DDP landed-cost quotes (edge). Falls back to empty on soft failure. */
export async function fetchEasyshipDdpQuotes(input: {
  cartItemIds: string[]
  shippingAddressId: string
}): Promise<{ byShop: Record<string, EasyshipDdpShopQuote>; error: string | null }> {
  if (!input.cartItemIds.length || !input.shippingAddressId) {
    return { byShop: {}, error: null }
  }
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean
    error?: string
    by_shop?: Record<string, EasyshipDdpShopQuote>
  }>('easyship-ddp-rates', {
    body: {
      cart_item_ids: input.cartItemIds,
      shipping_address_id: input.shippingAddressId,
    },
  })
  if (error) {
    return { byShop: {}, error: error.message || 'Could not load DDP shipping rates' }
  }
  if (data?.error) return { byShop: {}, error: data.error }
  return { byShop: data?.by_shop ?? {}, error: null }
}

/** Merge Easyship DDP totals into the checkout shipping quote shape. */
export function applyEasyshipDdpToCheckoutQuote(input: {
  base: CheckoutShippingQuote
  ddpByShop: Record<string, EasyshipDdpShopQuote>
}): CheckoutShippingQuote {
  let shippingTotal = 0
  const byShop = input.base.byShop.map((shop) => {
    const ddp = input.ddpByShop[shop.shopId]
    if (!ddp || !shop.requiresShipping) return shop
    const total = round2(Number(ddp.total_charge ?? 0))
    shippingTotal += total
    return {
      ...shop,
      shippingAmount: total,
      shipmentCharge: round2(Number(ddp.shipment_charge ?? 0)),
      taxAmount: round2(Number(ddp.tax_amount ?? 0)),
      dutyAmount: round2(Number(ddp.duty_amount ?? 0)),
      handlingFee: round2(Number(ddp.handling_fee ?? 0)),
      isFreeShipping: total <= 0,
      deliveryProfileId: null,
      deliveryProfileName: ddp.courier_name || 'International shipping',
      estimatedDays: Math.max(1, Number(ddp.estimated_days) || shop.estimatedDays),
      estimatedDeliveryDate: calculateEstimatedDeliveryDate(
        Math.max(1, Number(ddp.estimated_days) || shop.estimatedDays),
      )
        .toISOString()
        .slice(0, 10),
      courierName: ddp.courier_name,
    }
  })
  if (!Object.keys(input.ddpByShop).length) return input.base
  return {
    byShop,
    shippingTotal: round2(shippingTotal),
    itemsTotal: input.base.itemsTotal,
    grandTotal: round2(input.base.itemsTotal + shippingTotal),
  }
}

/** Payload for atomic_marketplace_checkout p_easyship_by_shop. */
export function easyshipByShopPayload(
  ddpByShop: Record<string, EasyshipDdpShopQuote>,
): Record<string, Record<string, number | string | null>> {
  const out: Record<string, Record<string, number | string | null>> = {}
  for (const [shopId, q] of Object.entries(ddpByShop)) {
    out[shopId] = {
      shipment_charge: round2(Number(q.shipment_charge ?? 0)),
      tax_amount: round2(Number(q.tax_amount ?? 0)),
      duty_amount: round2(Number(q.duty_amount ?? 0)),
      handling_fee: round2(Number(q.handling_fee ?? 0)),
      shipping_amount: round2(Number(q.shipping_amount ?? q.shipment_charge ?? 0)),
      total_charge: round2(Number(q.total_charge ?? 0)),
      estimated_days: Math.max(1, Number(q.estimated_days) || 7),
      courier_service_id: q.courier_service_id,
      courier_name: q.courier_name,
    }
  }
  return out
}

