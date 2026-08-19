import type {
  FollowedShopDigestItem,
  FollowedShopDigestSection,
} from '~/commerce/lib/followed-shop-digest'
import { formatMoneyLabel } from '~/lib/format'
import { commerceRoutes } from '~/lib/routes'

export type FollowedShopActivityCard = {
  listingId: string
  source: FollowedShopDigestItem['source']
  sourceLabel: string
  title: string
  priceLabel: string
  previousPriceLabel: string | null
  subtitle: string | null
  imageUrl: string | null
  href: string
  score: number
}

const SOURCE_LABELS: Record<FollowedShopDigestItem['source'], string> = {
  price_drop: 'Price drop',
  new_arrival: 'New',
  saved_overlap: 'Saved',
}

const SECTION_ORDER: FollowedShopDigestSection['key'][] = [
  'price_drops',
  'new_arrivals',
  'saved_overlap',
]

function listingTitle(item: FollowedShopDigestItem) {
  return item.card_title?.trim() || item.title.trim() || 'Listing'
}

function listingHref(item: FollowedShopDigestItem) {
  return commerceRoutes.listing(item.slug ?? item.id)
}

export function buildFollowedShopActivityCards(
  sections: FollowedShopDigestSection[],
  limit = 8,
): FollowedShopActivityCard[] {
  const bySection = new Map(sections.map((section) => [section.key, section]))
  const merged: FollowedShopDigestItem[] = []
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
    source: item.source,
    sourceLabel: SOURCE_LABELS[item.source],
    title: listingTitle(item),
    priceLabel: formatMoneyLabel(item.price, item.currency),
    previousPriceLabel:
      item.previousPrice && item.previousPrice > item.price
        ? formatMoneyLabel(item.previousPrice, item.currency)
        : null,
    subtitle: item.shop_name?.trim() || null,
    imageUrl: item.image_url,
    href: listingHref(item),
    score: item.score,
  }))
}
