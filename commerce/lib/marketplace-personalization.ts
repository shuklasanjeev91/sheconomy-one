import type { ListingSummary } from '~/commerce/lib/commerce'

export type UserGeo = {
  city?: string | null
  state?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type ShopAddressHint = {
  city?: string | null
  state?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type EnrichedListingSummary = ListingSummary & {
  shop_id?: string | null
  created_at?: string | null
  shop_rating?: number | null
  shop_review_count?: number | null
  shop_verified?: boolean
  shop_address?: ShopAddressHint | null
}

export type MarketplaceSignals = {
  userGeo: UserGeo
  searchQuery: string
  cartListingIds: ReadonlySet<string>
  favoriteListingIds: ReadonlySet<string>
  trendingIds: ReadonlySet<string>
  bestsellerRank: ReadonlyMap<string, number>
  orderCounts: ReadonlyMap<string, number>
}

export type ListingBadgeKind =
  | 'in_your_cart'
  | 'picked_for_you'
  | 'best_seller'
  | 'trending'
  | 'top_rated'
  | 'near_you'
  | 'star_seller'
  | 'new'
  | 'popular'

export type ListingBadge = {
  kind: ListingBadgeKind
  label: string
  tone: 'brand' | 'success' | 'info' | 'neutral' | 'accent'
}

const NEW_LISTING_DAYS = 14
const NEARBY_KM = 120

export { inferCountryFromLocale } from '~/commerce/lib/infer-country-from-locale'

export function parseProfileLocation(location?: string | null): UserGeo {
  if (!location?.trim()) return {}
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 3) {
    return { city: parts[0], state: parts[1], country: parts[2] }
  }
  if (parts.length === 2) {
    return { city: parts[0], state: parts[1] }
  }
  return { city: parts[0] ?? null }
}

function normalizePlace(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isNewListing(createdAt?: string | null) {
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  const ageMs = Date.now() - created
  return ageMs >= 0 && ageMs <= NEW_LISTING_DAYS * 24 * 60 * 60 * 1000
}

function listingMatchesSearch(listing: EnrichedListingSummary, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return false
  const haystack = [listing.title, listing.card_title, listing.shop_name, listing.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

function getNearYouLabel(listing: EnrichedListingSummary, geo: UserGeo): string | null {
  const address = listing.shop_address
  if (!address) return null

  const userCountry = normalizePlace(geo.country)
  const shopCountry = normalizePlace(address.country)
  const userCity = normalizePlace(geo.city)
  const shopCity = normalizePlace(address.city)
  const userState = normalizePlace(geo.state)
  const shopState = normalizePlace(address.state)

  if (
    geo.latitude != null &&
    geo.longitude != null &&
    address.latitude != null &&
    address.longitude != null
  ) {
    const distance = haversineKm(
      geo.latitude,
      geo.longitude,
      address.latitude,
      address.longitude,
    )
    if (distance <= NEARBY_KM) {
      return distance <= 40 ? 'Near you' : `Ships from ${address.city ?? address.state ?? 'nearby'}`
    }
  }

  if (userCity && shopCity && userCity === shopCity) {
    return 'Near you'
  }

  if (userState && shopState && userState === shopState && userCountry && shopCountry && userCountry === shopCountry) {
    return `Ships from ${address.state ?? address.city ?? 'your region'}`
  }

  if (userCountry && shopCountry && userCountry === shopCountry) {
    return `Made in ${address.country ?? 'India'}`
  }

  return null
}

export function scoreListing(
  listing: EnrichedListingSummary,
  signals: MarketplaceSignals,
): number {
  let score = 0

  if (signals.cartListingIds.has(listing.id)) score += 60
  if (signals.favoriteListingIds.has(listing.id)) score += 45
  if (signals.searchQuery && listingMatchesSearch(listing, signals.searchQuery)) score += 40

  const bestsellerRank = signals.bestsellerRank.get(listing.id)
  if (bestsellerRank != null) {
    score += Math.max(8, 36 - bestsellerRank * 0.35)
  }

  if (signals.trendingIds.has(listing.id)) score += 28

  const orderCount = signals.orderCounts.get(listing.id) ?? 0
  if (orderCount >= 10) score += Math.min(24, 8 + Math.log10(orderCount) * 6)

  const rating = listing.average_rating ?? 0
  const reviews = listing.total_reviews ?? 0
  if (rating >= 4.5 && reviews >= 5) score += 22
  else if (rating >= 4 && reviews >= 3) score += 12

  const shopRating = listing.shop_rating ?? 0
  const shopReviews = listing.shop_review_count ?? 0
  if (listing.shop_verified) score += 10
  if (shopRating >= 4.5 && shopReviews >= 10) score += 14

  if (getNearYouLabel(listing, signals.userGeo)) score += 20

  // Prefer listings that ship from the member's selected / detected country.
  const userCountry = normalizePlace(signals.userGeo.country)
  const shopCountry = normalizePlace(listing.shop_address?.country)
  if (userCountry && shopCountry && userCountry === shopCountry) {
    score += 16
  }

  if (isNewListing(listing.created_at)) score += 8

  if (listing.is_featured) score += 8

  return score
}

export function resolveListingBadge(
  listing: EnrichedListingSummary,
  signals: MarketplaceSignals,
): ListingBadge | null {
  const candidates: Array<{ badge: ListingBadge; priority: number }> = []

  if (signals.cartListingIds.has(listing.id)) {
    candidates.push({
      badge: { kind: 'in_your_cart', label: 'In your cart', tone: 'brand' },
      priority: 100,
    })
  }

  if (signals.searchQuery && listingMatchesSearch(listing, signals.searchQuery)) {
    candidates.push({
      badge: { kind: 'picked_for_you', label: 'Matches your search', tone: 'accent' },
      priority: 96,
    })
  } else if (signals.favoriteListingIds.has(listing.id)) {
    candidates.push({
      badge: { kind: 'picked_for_you', label: 'Saved for you', tone: 'accent' },
      priority: 94,
    })
  }

  const bestsellerRank = signals.bestsellerRank.get(listing.id)
  if (bestsellerRank != null && bestsellerRank <= 100) {
    candidates.push({
      badge: { kind: 'best_seller', label: 'Best seller', tone: 'brand' },
      priority: 92 - Math.min(20, bestsellerRank * 0.15),
    })
  }

  if (signals.trendingIds.has(listing.id)) {
    candidates.push({
      badge: { kind: 'trending', label: 'Trending now', tone: 'accent' },
      priority: 88,
    })
  }

  const orderCount = signals.orderCounts.get(listing.id) ?? 0
  if (orderCount >= 25 && !signals.trendingIds.has(listing.id)) {
    candidates.push({
      badge: { kind: 'popular', label: `${orderCount}+ bought`, tone: 'neutral' },
      priority: 72,
    })
  }

  if ((listing.average_rating ?? 0) >= 4.5 && (listing.total_reviews ?? 0) >= 5) {
    candidates.push({
      badge: { kind: 'top_rated', label: 'Top rated', tone: 'success' },
      priority: 80,
    })
  }

  const nearLabel = getNearYouLabel(listing, signals.userGeo)
  if (nearLabel) {
    candidates.push({
      badge: { kind: 'near_you', label: nearLabel, tone: 'info' },
      priority: 76,
    })
  }

  if (listing.shop_verified && (listing.shop_rating ?? 0) >= 4.5 && (listing.shop_review_count ?? 0) >= 5) {
    candidates.push({
      badge: { kind: 'star_seller', label: 'Star seller', tone: 'success' },
      priority: 70,
    })
  }

  if (isNewListing(listing.created_at)) {
    candidates.push({
      badge: { kind: 'new', label: 'New arrival', tone: 'info' },
      priority: 64,
    })
  }

  if (!candidates.length) return null

  candidates.sort((a, b) => b.priority - a.priority)
  return candidates[0]?.badge ?? null
}

export function personalizeListings<T extends EnrichedListingSummary>(
  listings: T[],
  signals: MarketplaceSignals,
  options?: { sort?: boolean },
): T[] {
  const withScores = listings.map((listing) => ({
    listing,
    score: scoreListing(listing, signals),
    badge: resolveListingBadge(listing, signals),
  }))

  if (!options?.sort) {
    return listings
  }

  return [...withScores]
    .sort((a, b) => b.score - a.score || (b.listing.average_rating ?? 0) - (a.listing.average_rating ?? 0))
    .map((entry) => entry.listing)
}

export async function fetchMarketplaceDemandSignals() {
  const { supabase } = await import('~/lib/supabase/client')

  const [trendingResult, bestsellerResult] = await Promise.all([
    supabase.rpc('get_marketplace_trending_listings', { max_results: 250 }),
    supabase.rpc('get_marketplace_bestseller_listings', { max_results: 250, min_orders: 1 }),
  ])

  const trendingIds = new Set<string>()
  const orderCounts = new Map<string, number>()
  const bestsellerRank = new Map<string, number>()

  for (const row of trendingResult.data ?? []) {
    trendingIds.add(row.id)
    if (row.order_count) orderCounts.set(row.id, row.order_count)
  }

  ;(bestsellerResult.data ?? []).forEach((row, index) => {
    bestsellerRank.set(row.id, index + 1)
    if (row.order_count) {
      orderCounts.set(row.id, Math.max(orderCounts.get(row.id) ?? 0, row.order_count))
    }
  })

  return { trendingIds, bestsellerRank, orderCounts }
}
