import { supabase } from '~/lib/supabase/client'

export type SaleEventSummary = {
  id: string
  eventName: string
  eventSlug: string
  description: string | null
  bannerImage: string | null
  endDate: string | null
}

/** Active marketplace sale events for home/shop promo banners. */
export async function fetchActiveSaleEvents(): Promise<SaleEventSummary[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('sale_events')
    .select('id, event_name, event_slug, description, banner_image, end_date, status, start_date')
    .eq('status', 'active')
    .lte('start_date', now)
    .gte('end_date', now)
    .order('start_date', { ascending: false })
    .limit(5)

  if (error || !data?.length) return []

  return data.map((row) => ({
    id: row.id,
    eventName: row.event_name,
    eventSlug: row.event_slug,
    description: row.description,
    bannerImage: row.banner_image,
    endDate: row.end_date,
  }))
}
