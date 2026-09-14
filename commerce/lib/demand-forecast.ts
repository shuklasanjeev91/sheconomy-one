import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'

export type ListingDemandForecast = Tables<'listing_demand_forecasts'> & {
  title?: string | null
}

export async function fetchShopDemandForecasts(shopId: string): Promise<ListingDemandForecast[]> {
  const { data, error } = await supabase
    .from('listing_demand_forecasts')
    .select('*')
    .eq('shop_id', shopId)
    .order('stock_cover_days', { ascending: true, nullsFirst: false })
    .limit(80)

  if (error || !data) return []
  const listingIds = data.map((row) => row.listing_id)
  const { data: listings } = listingIds.length
    ? await supabase.from('listings').select('id, title').in('id', listingIds)
    : { data: [] as Array<{ id: string; title: string }> }
  const titles = new Map((listings ?? []).map((row) => [row.id, row.title]))
  return data.map((row) => ({
    ...row,
    title: titles.get(row.listing_id) ?? null,
  }))
}

export async function refreshShopDemandForecasts(): Promise<number> {
  const { data } = await supabase.rpc('refresh_listing_demand_forecasts')
  return typeof data === 'number' ? data : 0
}
