import type { CartItemRow } from '~/commerce/lib/cart'

/**
 * Marketplace multi-vendor key for a cart line.
 * `cart_items.shop_id` is the seller/shop unit used for split checkout & settlement.
 */
export function getCartItemSellerId(item: Pick<CartItemRow, 'shop_id'>): string {
  return item.shop_id
}

export type CartSellerGroup = {
  seller_id: string
  shop_id: string
  shop_name: string
  items: CartItemRow[]
}

/** Group cart lines by seller_id (shop) for multi-vendor checkout prep. */
export function groupCartItemsBySeller(items: CartItemRow[]): CartSellerGroup[] {
  const map = new Map<string, CartSellerGroup>()
  for (const item of items) {
    const sellerId = getCartItemSellerId(item)
    const existing = map.get(sellerId)
    if (existing) {
      existing.items.push(item)
      continue
    }
    map.set(sellerId, {
      seller_id: sellerId,
      shop_id: item.shop_id,
      shop_name: item.shop_name || 'Shop',
      items: [item],
    })
  }
  return [...map.values()]
}
