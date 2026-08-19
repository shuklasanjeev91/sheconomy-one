import {
  buildWishlistReactivation,
  type WishlistReactivationItem,
  type WishlistReactivationSection,
} from '~/commerce/lib/wishlist-reactivation'
import { formatMoneyLabel } from '~/lib/format'
import { commerceRoutes } from '~/lib/routes'

export type WishlistActivityCard = {
  listingId: string
  sourceLabel: string
  title: string
  priceLabel: string
  previousPriceLabel: string | null
  imageUrl: string | null
  href: string
  score: number
}

const SECTION_ORDER: WishlistReactivationSection['key'][] = [
  'saved_from_cart',
  'price_wins',
  'ready_to_buy',
  'more_saved',
]

const SOURCE_LABELS: Record<WishlistReactivationItem['source'], string> = {
  saved_from_cart: 'Saved from cart',
  discount: 'Price win',
  saved: 'Saved',
}

function listingHref(item: WishlistReactivationItem) {
  return commerceRoutes.listing(item.slug ?? item.id)
}

export function buildWishlistActivityCards(
  sections: WishlistReactivationSection[],
  limit = 8,
): WishlistActivityCard[] {
  const bySection = new Map(sections.map((section) => [section.key, section]))
  const merged: WishlistReactivationItem[] = []
  const seen = new Set<string>()

  for (const key of SECTION_ORDER) {
    const section = bySection.get(key)
    if (!section) continue
    for (const item of section.items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      merged.push(item)
    }
  }

  merged.sort((a, b) => b.score - a.score)

  return merged.slice(0, limit).map((item) => ({
    listingId: item.id,
    sourceLabel: SOURCE_LABELS[item.source],
    title: item.card_title?.trim() || item.title,
    priceLabel: formatMoneyLabel(item.price, item.currency),
    previousPriceLabel:
      item.discountAmount > 0 && typeof item.mrp === 'number' && item.mrp > item.price
        ? formatMoneyLabel(item.mrp, item.currency)
        : null,
    imageUrl: item.image_url,
    href: listingHref(item),
    score: item.score,
  }))
}

export function buildWishlistActivityCardsFromItems(
  items: WishlistReactivationItem[],
  limit = 8,
): WishlistActivityCard[] {
  return buildWishlistActivityCards(
    buildWishlistReactivation({
      items,
      savedFromCart: Object.fromEntries(
        items
          .filter((item) => item.savedFromCartAt)
          .map((item) => [item.id, item.savedFromCartAt as number]),
      ),
    }).sections,
    limit,
  )
}
