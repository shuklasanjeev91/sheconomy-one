import { Platform } from 'react-native'

import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import { peekAppCache, prefetchAppCache, writeAppCache } from '~/lib/cache/app-cache'
import { hasListingImages } from '~/commerce/lib/listing-images'

import {
  fetchActiveListingCards,
  fetchListingsByIds,
  type ListingSummary,
} from '~/commerce/lib/commerce'

const DEFAULT_LIMIT = Platform.OS === 'web' ? 12 : 6

function cacheKey(
  kind: 'related' | 'shop' | 'personalized',
  id: string,
  limit: number,
) {
  // v2: image-required cards (invalidates stale placeholder-only rails)
  return `listing-recs:v2:${kind}:${id}:${limit}`
}

function withImages(items: ListingSummary[], limit?: number): ListingSummary[] {
  const filtered = items.filter((item) => hasListingImages(item.image_urls, item.image_url))
  return typeof limit === 'number' ? filtered.slice(0, limit) : filtered
}

/** Instant picks from already-warmed home feeds (zero network). */
export function listingCardsFromHomeCache(
  excludeId: string,
  limit: number,
): ListingSummary[] {
  const kinds = ['trending', 'physical', 'featured', 'digital', 'latest'] as const
  const seen = new Set<string>([excludeId])
  const out: ListingSummary[] = []

  for (const kind of kinds) {
    const snapshot = peekAppCache<{ items: ListingSummary[] }>(CACHE_KEYS.listingFeed(kind))
    for (const item of snapshot?.items ?? []) {
      if (seen.has(item.id)) continue
      if (!hasListingImages(item.image_urls, item.image_url)) continue
      seen.add(item.id)
      out.push(item)
      if (out.length >= limit) return out
    }
  }
  return out
}

export type RelatedListingContext = {
  shopId?: string | null
  category?: string | null
  listingType?: string | null
}

/** Similar listings — native skips RPCs; prefers home cache + one light query. */
export async function fetchRelatedListings(
  listingId: string,
  limit = DEFAULT_LIMIT,
  context?: RelatedListingContext,
): Promise<ListingSummary[]> {
  const key = cacheKey('related', listingId, limit)
  const cached = withImages(peekAppCache<ListingSummary[]>(key) ?? [])
  if (cached.length) return cached.slice(0, limit)

  const fromHome = listingCardsFromHomeCache(listingId, limit)
  if (fromHome.length >= Math.min(4, limit)) {
    void writeAppCache(key, fromHome)
    // Still refresh in background when we have category/shop context.
    if (context?.category?.trim() || context?.listingType) {
      void refreshRelated(listingId, limit, context, key)
    }
    return fromHome
  }

  return refreshRelated(listingId, limit, context, key)
}

async function refreshRelated(
  listingId: string,
  limit: number,
  context: RelatedListingContext | undefined,
  key: string,
): Promise<ListingSummary[]> {
  const fetchLimit = Math.max(limit * 2, limit + 6)

  // Native: never wait on recommendation RPCs (often multi-second).
  if (Platform.OS !== 'web') {
    const items = await fetchActiveListingCards({
      category: context?.category,
      listingType: context?.category?.trim() ? null : context?.listingType,
      excludeId: listingId,
      limit: fetchLimit,
      orderBy: 'average_rating',
    })
    const merged = (items.length ? items : listingCardsFromHomeCache(listingId, fetchLimit)).slice(
      0,
      limit,
    )
    if (merged.length) void writeAppCache(key, merged)
    return merged
  }

  // Web: try RPC briefly, then fall back to light cards.
  try {
    const { supabase } = await import('~/lib/supabase/client')
    const { data } = await supabase.rpc('get_listing_recommendations', {
      p_listing_id: listingId,
      p_limit: fetchLimit,
    })
    const rows = (data ?? []).filter((row) => row.id !== listingId)
    const ids = rows.map((row) => row.id)
    if (ids.length) {
      const hydrated = await fetchListingsByIds(ids)
      const byId = new Map(hydrated.map((item) => [item.id, item]))
      const items: ListingSummary[] = []
      for (const row of rows) {
        const card = byId.get(row.id)
        if (card && hasListingImages(card.image_urls, card.image_url)) {
          items.push(card)
        } else if (row.primary_image_url && hasListingImages([row.primary_image_url])) {
          // RPC already resolved a primary image — keep the rail filled if hydrate misses.
          items.push({
            id: row.id,
            slug: row.slug ?? null,
            title: row.title,
            card_title: row.title,
            price: Number(row.price),
            listing_type: 'physical',
            average_rating: null,
            total_reviews: null,
            image_url: row.primary_image_url,
            image_urls: [row.primary_image_url],
            images: [
              {
                id: `${row.id}-primary`,
                image_url: row.primary_image_url,
                is_primary: true,
                display_order: 0,
                alt_text: row.title,
              },
            ],
            shop_name: row.shop_name ?? null,
            shop_id: null,
            category: null,
            created_at: null,
            currency: 'INR',
            is_featured: false,
            shop_rating: null,
            shop_review_count: null,
            shop_verified: false,
          })
        }
        if (items.length >= limit) break
      }
      if (items.length) {
        void writeAppCache(key, items)
        return items
      }
    }
  } catch {
    // fall through
  }

  const items = await fetchActiveListingCards({
    category: context?.category,
    listingType: context?.listingType,
    excludeId: listingId,
    limit: fetchLimit,
    orderBy: 'average_rating',
  })
  const sliced = items.slice(0, limit)
  if (sliced.length) void writeAppCache(key, sliced)
  return sliced
}

/** Other active listings from the same shop. */
export async function fetchMoreFromShop(
  shopId: string,
  excludeListingId?: string | null,
  limit = DEFAULT_LIMIT,
): Promise<ListingSummary[]> {
  if (!shopId) return []

  const key = cacheKey('shop', `${shopId}:${excludeListingId ?? ''}`, limit)
  const cached = withImages(peekAppCache<ListingSummary[]>(key) ?? [], limit)
  if (cached.length) return cached

  const items = await fetchActiveListingCards({
    shopId,
    excludeId: excludeListingId,
    limit: Math.max(limit * 2, limit + 4),
    orderBy: 'average_rating',
  })
  const sliced = withImages(items, limit)
  if (sliced.length) void writeAppCache(key, sliced)
  return sliced
}

/** Marketplace picks — native uses home-cache first, never blocks on RPCs. */
export async function fetchPersonalizedListings(
  excludeIds: string[],
  limit = DEFAULT_LIMIT,
): Promise<ListingSummary[]> {
  const exclude = new Set(excludeIds)
  const cacheId = excludeIds[0] ?? 'anon'
  const key = cacheKey('personalized', cacheId, limit)
  const cached = withImages(peekAppCache<ListingSummary[]>(key) ?? [])
  if (cached.length) {
    return cached.filter((item) => !exclude.has(item.id)).slice(0, limit)
  }

  const fromHome = listingCardsFromHomeCache(excludeIds[0] ?? '', limit).filter(
    (item) => !exclude.has(item.id),
  )
  if (fromHome.length) {
    void writeAppCache(key, fromHome)
    return fromHome.slice(0, limit)
  }

  if (Platform.OS !== 'web') {
    const items = await fetchActiveListingCards({
      listingType: 'physical',
      excludeId: excludeIds[0],
      limit: Math.max(limit * 2, limit + 4),
      orderBy: 'average_rating',
    })
    const sliced = items.filter((item) => !exclude.has(item.id)).slice(0, limit)
    if (sliced.length) void writeAppCache(key, sliced)
    return sliced
  }

  try {
    const { supabase } = await import('~/lib/supabase/client')
    const { data } = await supabase.rpc('get_marketplace_recommended_listings', {
      max_results: Math.max(limit * 2, 24),
    })
    const ids = (data ?? []).map((row) => row.id).filter((id) => !exclude.has(id))
    const items = (await fetchListingsByIds(ids)).slice(0, limit)
    if (items.length) void writeAppCache(key, items)
    return items
  } catch {
    return []
  }
}

/** Warm PDP recommendation rails while the user is still on a listing card. */
export function prefetchListingRecommendations(
  listingId: string,
  shopId?: string | null,
  limit = DEFAULT_LIMIT,
  context?: RelatedListingContext,
): void {
  if (!listingId) return
  prefetchAppCache(cacheKey('related', listingId, limit), () =>
    fetchRelatedListings(listingId, limit, context),
  )
  if (shopId) {
    prefetchAppCache(cacheKey('shop', `${shopId}:${listingId}`, limit), () =>
      fetchMoreFromShop(shopId, listingId, limit),
    )
  }
  prefetchAppCache(cacheKey('personalized', listingId, limit), () =>
    fetchPersonalizedListings([listingId], limit),
  )
}
