import { supabase } from '~/lib/supabase/client'

import { fetchListingsByIds, type ListingSummary } from './commerce'
import { ACTIVE_LISTING_FILTER } from './listing-visibility'

const DEFAULT_LIMIT = 12

async function fetchRelatedListingsFallback(
  listingId: string,
  limit: number,
): Promise<ListingSummary[]> {
  const { data: source } = await supabase
    .from('listings')
    .select('shop_id, category, listing_type, category_assignments(category_id)')
    .eq('id', listingId)
    .maybeSingle()

  if (!source) return []

  const collected: string[] = []
  const seen = new Set<string>([listingId])

  const addIds = (ids: string[]) => {
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id)
        collected.push(id)
        if (collected.length >= limit) break
      }
    }
  }

  const categoryIds =
    (source.category_assignments as Array<{ category_id: string }> | null)
      ?.map((row) => row.category_id)
      .filter(Boolean) ?? []

  if (collected.length < limit && categoryIds.length) {
    const { data } = await supabase
      .from('listings')
      .select('id, category_assignments!inner(category_id)')
      .in('category_assignments.category_id', categoryIds)
      .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
      .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
      .neq('id', listingId)
      .order('average_rating', { ascending: false, nullsFirst: false })
      .limit(limit * 2)

    addIds((data ?? []).map((row) => row.id))
  }

  if (collected.length < limit && source.shop_id) {
    const { data } = await supabase
      .from('listings')
      .select('id')
      .eq('shop_id', source.shop_id)
      .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
      .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
      .neq('id', listingId)
      .order('created_at', { ascending: false })
      .limit(limit * 2)

    addIds((data ?? []).map((row) => row.id))
  }

  if (collected.length < limit && source.category) {
    const { data } = await supabase
      .from('listings')
      .select('id')
      .eq('category', source.category)
      .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
      .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
      .neq('id', listingId)
      .order('average_rating', { ascending: false, nullsFirst: false })
      .limit(limit * 2)

    addIds((data ?? []).map((row) => row.id))
  }

  if (collected.length < limit && source.listing_type) {
    const { data } = await supabase
      .from('listings')
      .select('id')
      .eq('listing_type', source.listing_type)
      .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
      .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
      .neq('id', listingId)
      .order('created_at', { ascending: false })
      .limit(limit * 2)

    addIds((data ?? []).map((row) => row.id))
  }

  return fetchListingsByIds(collected.slice(0, limit))
}

/** Similar listings for a product detail page. */
export async function fetchRelatedListings(
  listingId: string,
  limit = DEFAULT_LIMIT,
): Promise<ListingSummary[]> {
  const { data: rpcRows, error } = await supabase.rpc('get_listing_recommendations', {
    p_listing_id: listingId,
    p_limit: limit + 4,
  })

  if (!error && rpcRows?.length) {
    const ids = rpcRows.map((row) => row.id).filter((id) => id !== listingId)
    if (ids.length) {
      return (await fetchListingsByIds(ids)).slice(0, limit)
    }
  }

  return fetchRelatedListingsFallback(listingId, limit)
}

/** Marketplace picks personalized for the signed-in user and demand signals. */
export async function fetchPersonalizedListings(
  excludeIds: string[],
  limit = DEFAULT_LIMIT,
): Promise<ListingSummary[]> {
  const exclude = new Set(excludeIds)
  const fetchSize = Math.max(limit * 3, 36)

  const { data: recommended, error: recommendedError } = await supabase.rpc(
    'get_marketplace_recommended_listings',
    { max_results: fetchSize },
  )

  let ids: string[] = []
  if (!recommendedError && recommended?.length) {
    ids = recommended.map((row) => row.id)
  } else {
    const { data: trending } = await supabase.rpc('get_marketplace_trending_listings', {
      max_results: fetchSize,
    })
    ids = (trending ?? []).map((row) => row.id)
  }

  const filtered = ids.filter((id) => !exclude.has(id)).slice(0, limit + 6)
  return (await fetchListingsByIds(filtered)).slice(0, limit)
}
