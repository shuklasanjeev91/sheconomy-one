import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'

export type ListingBundle = Tables<'listing_bundles'> & {
  items: Array<Tables<'listing_bundle_items'> & { title?: string | null; price?: number | null }>
}

export async function fetchActiveBundlesForListing(listingId: string): Promise<ListingBundle[]> {
  const { data: links, error } = await supabase
    .from('listing_bundle_items')
    .select('bundle_id')
    .eq('listing_id', listingId)
  if (error || !links?.length) return []
  return fetchBundlesByIds([...new Set(links.map((row) => row.bundle_id))])
}

export async function fetchShopBundles(shopId: string): Promise<ListingBundle[]> {
  const { data, error } = await supabase
    .from('listing_bundles')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
  if (error || !data?.length) return []
  return hydrateBundleItems(data)
}

async function fetchBundlesByIds(ids: string[]): Promise<ListingBundle[]> {
  const { data, error } = await supabase
    .from('listing_bundles')
    .select('*')
    .in('id', ids)
    .eq('is_active', true)
  if (error || !data?.length) return []
  return hydrateBundleItems(data)
}

async function hydrateBundleItems(bundles: Tables<'listing_bundles'>[]): Promise<ListingBundle[]> {
  const ids = bundles.map((row) => row.id)
  const { data: items } = await supabase
    .from('listing_bundle_items')
    .select('*')
    .in('bundle_id', ids)
    .order('display_order')

  const listingIds = [...new Set((items ?? []).map((item) => item.listing_id))]
  const { data: listings } = listingIds.length
    ? await supabase.from('listings').select('id, title, price').in('id', listingIds)
    : { data: [] as Array<{ id: string; title: string; price: number }> }
  const listingById = new Map((listings ?? []).map((row) => [row.id, row]))

  const byBundle = new Map<string, ListingBundle['items']>()
  for (const item of items ?? []) {
    const listing = listingById.get(item.listing_id)
    const row = {
      ...item,
      title: listing?.title ?? null,
      price: listing?.price ?? null,
    }
    const list = byBundle.get(item.bundle_id) ?? []
    list.push(row)
    byBundle.set(item.bundle_id, list)
  }

  return bundles.map((bundle) => ({ ...bundle, items: byBundle.get(bundle.id) ?? [] }))
}

export async function saveShopBundle(input: {
  id?: string
  shopId: string
  title: string
  bundlePrice: number
  listingIds: string[]
}): Promise<{ error: string | null }> {
  const payload = {
    shop_id: input.shopId,
    title: input.title.trim(),
    bundle_price: input.bundlePrice,
    is_active: true,
  }
  const query = input.id
    ? supabase.from('listing_bundles').update(payload).eq('id', input.id).select('id').maybeSingle()
    : supabase.from('listing_bundles').insert(payload).select('id').maybeSingle()
  const { data, error } = await query
  if (error || !data?.id) return { error: error?.message ?? 'Could not save bundle' }

  await supabase.from('listing_bundle_items').delete().eq('bundle_id', data.id)
  if (input.listingIds.length) {
    const { error: itemError } = await supabase.from('listing_bundle_items').insert(
      input.listingIds.map((listingId, index) => ({
        bundle_id: data.id,
        listing_id: listingId,
        quantity: 1,
        display_order: index,
      })),
    )
    if (itemError) return { error: itemError.message }
  }
  return { error: null }
}

export async function setBundleActive(bundleId: string, isActive: boolean): Promise<string | null> {
  const { error } = await supabase.from('listing_bundles').update({ is_active: isActive }).eq('id', bundleId)
  return error?.message ?? null
}
