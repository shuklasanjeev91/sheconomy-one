import { supabase } from '~/lib/supabase/client'

export type StockAlertState = 'watching' | 'back_in_stock' | 'inactive'

export type StockAlertListing = {
  listingId: string
  slug: string | null
  title: string
  imageUrl: string | null
  shopName: string | null
  price: number | null
  currency: string | null
  stock: number | null
  isActive: boolean
  listingStatus: string | null
  subscribedAt: string | null
  notifiedAt: string | null
  state: StockAlertState
}

export type StockAlertSection = {
  key: StockAlertState
  title: string
  subtitle: string
  items: StockAlertListing[]
}

const LISTING_ALERT_SELECT = `
  id,
  slug,
  title,
  price,
  stock,
  is_active,
  listing_status,
  listing_images(id, image_url, is_primary, display_order),
  shops(shop_name, shop_currency)
`

export function dedupeStockAlertListingIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))]
}

export function classifyStockAlertState(input: {
  stock?: number | null
  isActive?: boolean | null
  listingStatus?: string | null
}): StockAlertState {
  if (input.isActive && input.listingStatus === 'active' && Number(input.stock ?? 0) > 0) {
    return 'back_in_stock'
  }
  if (!input.isActive || input.listingStatus !== 'active') return 'inactive'
  return 'watching'
}

function sortImages(
  images: Array<{ image_url?: string | null; is_primary?: boolean | null; display_order?: number | null }> | null | undefined,
) {
  return [...(images ?? [])].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return Number(a.display_order ?? 0) - Number(b.display_order ?? 0)
  })
}

/** Subscribe the signed-in user to a back-in-stock alert for a listing. */
export async function subscribeStockAlert(
  listingId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('listing_stock_alerts').upsert(
    {
      listing_id: listingId,
      user_id: userId,
      notified_at: null,
    },
    { onConflict: 'listing_id,user_id' },
  )
  return { error: error?.message ?? null }
}

export async function unsubscribeStockAlert(
  listingId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('listing_stock_alerts')
    .delete()
    .eq('listing_id', listingId)
    .eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function isStockAlertSubscribed(
  listingId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('listing_stock_alerts')
    .select('id')
    .eq('listing_id', listingId)
    .eq('user_id', userId)
    .is('notified_at', null)
    .maybeSingle()
  return !!data
}

export async function fetchStockAlertListings(
  userId: string,
): Promise<{ items: StockAlertListing[]; error: string | null }> {
  const { data, error } = await supabase
    .from('listing_stock_alerts')
    .select('listing_id, created_at, notified_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return { items: [], error: error.message }
  const alertRows = (data as Array<{ listing_id: string; created_at?: string | null; notified_at?: string | null }> | null) ?? []
  const listingIds = dedupeStockAlertListingIds(alertRows.map((row) => row.listing_id))
  if (!listingIds.length) return { items: [], error: null }

  const { data: listingsData, error: listingsError } = await supabase
    .from('listings')
    .select(LISTING_ALERT_SELECT)
    .in('id', listingIds)

  if (listingsError) return { items: [], error: listingsError.message }
  const listingRows = (listingsData as Array<Record<string, any>> | null) ?? []
  const listingById = new Map(listingRows.map((row) => [String(row.id), row]))

  return {
    items: alertRows
      .map((alert) => {
        const listing = listingById.get(alert.listing_id)
        if (!listing) return null
        const images = sortImages(listing.listing_images)
        return {
          listingId: alert.listing_id,
          slug: (listing.slug as string | null) ?? null,
          title: String(listing.title ?? 'Listing'),
          imageUrl: (images[0]?.image_url as string | null) ?? null,
          shopName: (listing.shops?.shop_name as string | null) ?? null,
          price: typeof listing.price === 'number' ? listing.price : Number(listing.price ?? 0),
          currency: (listing.shops?.shop_currency as string | null) ?? null,
          stock: typeof listing.stock === 'number' ? listing.stock : Number(listing.stock ?? 0),
          isActive: Boolean(listing.is_active),
          listingStatus: (listing.listing_status as string | null) ?? null,
          subscribedAt: alert.created_at ?? null,
          notifiedAt: alert.notified_at ?? null,
          state: classifyStockAlertState({
            stock: listing.stock as number | null,
            isActive: listing.is_active as boolean | null,
            listingStatus: listing.listing_status as string | null,
          }),
        } satisfies StockAlertListing
      })
      .filter((item): item is StockAlertListing => item !== null),
    error: null,
  }
}

export function buildStockAlertSections(items: StockAlertListing[]): StockAlertSection[] {
  const backInStock = items.filter((item) => item.state === 'back_in_stock')
  const watching = items.filter((item) => item.state === 'watching')
  const inactive = items.filter((item) => item.state === 'inactive')
  return [
    backInStock.length
      ? {
          key: 'back_in_stock',
          title: 'Back in stock',
          subtitle: `${backInStock.length} item${backInStock.length === 1 ? '' : 's'} ready to revisit`,
          items: backInStock,
        }
      : null,
    watching.length
      ? {
          key: 'watching',
          title: 'Watching for restock',
          subtitle: `${watching.length} alert${watching.length === 1 ? '' : 's'} still active`,
          items: watching,
        }
      : null,
    inactive.length
      ? {
          key: 'inactive',
          title: 'Still unavailable',
          subtitle: `${inactive.length} listing${inactive.length === 1 ? '' : 's'} currently inactive`,
          items: inactive,
        }
      : null,
  ].filter((section): section is StockAlertSection => section !== null)
}
