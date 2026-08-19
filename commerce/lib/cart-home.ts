import type { CartItemRow } from '~/commerce/lib/cart'
import { commerceRoutes } from '~/lib/routes'

export type CartHomeCard = {
  cartItemId: string
  listingId: string
  title: string
  shopName: string
  unitPrice: number
  quantity: number
  imageUrl: string | null
  href: string
}

export function buildCartHomeCards(items: CartItemRow[], limit = 4): CartHomeCard[] {
  return items.slice(0, limit).map((item) => ({
    cartItemId: item.id,
    listingId: item.listing_id,
    title: item.title,
    shopName: item.shop_name,
    unitPrice: item.unit_price,
    quantity: item.quantity,
    imageUrl: item.image_url,
    href: commerceRoutes.listing(item.listing_id),
  }))
}

export function cartHomeHref() {
  return commerceRoutes.cart
}
