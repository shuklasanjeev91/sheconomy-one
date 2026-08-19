import type { WishlistReactivationSection } from '~/commerce/lib/wishlist-reactivation'

export type WishlistPriceDropCard = {
  listingId: string
  slug: string | null
  title: string
  price: number
  currency: string
  discountAmount: number
}

export function buildWishlistPriceDropCards(
  sections: WishlistReactivationSection[],
  limit = 6,
): WishlistPriceDropCard[] {
  const priceWins = sections.find((section) => section.key === 'price_wins')?.items ?? []
  return priceWins.slice(0, limit).map((item) => ({
    listingId: item.id,
    slug: item.slug ?? null,
    title: item.card_title ?? item.title,
    price: item.price,
    currency: item.currency ?? 'INR',
    discountAmount: item.discountAmount,
  }))
}
