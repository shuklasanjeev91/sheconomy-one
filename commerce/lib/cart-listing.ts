import type { CartItemRow } from '~/commerce/lib/cart'

/** Find the cart line for a listing + optional variant selection. */
export function findCartItemForListing(
  items: CartItemRow[],
  listingId: string,
  variantId?: string | null,
): CartItemRow | null {
  const variantKey = variantId ?? null
  return (
    items.find(
      (item) => item.listing_id === listingId && (item.variant_id ?? null) === variantKey,
    ) ?? null
  )
}
