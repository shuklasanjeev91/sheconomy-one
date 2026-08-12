import { supabase } from '~/lib/supabase/client'

export type LowStockListing = {
  id: string
  title: string
  stock: number
  slug: string | null
}

const DEFAULT_THRESHOLD = 5

export async function fetchLowStockListings(
  shopId: string,
  threshold = DEFAULT_THRESHOLD,
): Promise<{ listings: LowStockListing[]; error: string | null }> {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, stock, slug, listing_metadata')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .eq('listing_status', 'active')
    .order('stock', { ascending: true })
    .limit(40)

  if (error) return { listings: [], error: error.message }

  const listings = (data ?? [])
    .map((row) => {
      const meta =
        row.listing_metadata && typeof row.listing_metadata === 'object'
          ? (row.listing_metadata as Record<string, unknown>)
          : {}
      const metaThreshold = Number(meta.low_stock_threshold)
      const cut =
        Number.isFinite(metaThreshold) && metaThreshold > 0 ? metaThreshold : threshold
      const stock = Number(row.stock ?? 0)
      return {
        id: row.id,
        title: row.title,
        stock,
        slug: row.slug,
        cut,
      }
    })
    .filter((row) => row.stock <= row.cut)
    .map(({ id, title, stock, slug }) => ({ id, title, stock, slug }))

  return { listings, error: null }
}
