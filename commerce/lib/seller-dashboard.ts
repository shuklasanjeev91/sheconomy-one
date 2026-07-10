import { supabase } from '~/lib/supabase'
import type { Database } from '~/lib/supabase'

type ListingStatus = Database['public']['Enums']['listing_status_enum']

export type ShopListingsSummary = {
  shopId: string
  shopName: string
  totalListings: number
  activeListings: number
  draftListings: number
  publishedListings: number
  avgPrice: number | null
  shopVerified: boolean
  shopActive: boolean
}

export type ShopSalesSnapshot = {
  totalOrders: number
  totalRevenue: number
  uniqueCustomers: number
  totalUnitsSold: number
}

export type ShopDashboardData = {
  summary: ShopListingsSummary | null
  sales: ShopSalesSnapshot
  stats: Record<string, unknown> | null
}

export type SellerListingRow = {
  id: string
  title: string
  slug: string | null
  price: number
  quantity: number | null
  listingType: Database['public']['Enums']['listing_type_enum']
  listingStatus: ListingStatus
  isActive: boolean
  isFeatured: boolean
  primaryImageUrl: string | null
  updatedAt: string
  createdAt: string
}

function emptySales(): ShopSalesSnapshot {
  return {
    totalOrders: 0,
    totalRevenue: 0,
    uniqueCustomers: 0,
    totalUnitsSold: 0,
  }
}

export async function fetchShopListingsSummary(shopId: string): Promise<ShopListingsSummary | null> {
  const { data, error } = await supabase
    .from('shop_listings_summary')
    .select(
      'shop_id, shop_name, total_listings, active_listings, published_listings, avg_price, shop_verified, shop_active',
    )
    .eq('shop_id', shopId)
    .maybeSingle()

  if (error || !data?.shop_id) return null

  const { count: draftCount } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('listing_status', 'draft')

  return {
    shopId: data.shop_id,
    shopName: data.shop_name ?? 'Your shop',
    totalListings: data.total_listings ?? 0,
    activeListings: data.active_listings ?? 0,
    draftListings: draftCount ?? 0,
    publishedListings: data.published_listings ?? 0,
    avgPrice: data.avg_price,
    shopVerified: data.shop_verified ?? false,
    shopActive: data.shop_active ?? true,
  }
}

export async function fetchShopSalesSnapshot(shopId: string): Promise<ShopSalesSnapshot> {
  const { data, error } = await supabase
    .from('vendor_sales_analytics')
    .select('total_orders, total_revenue, unique_customers, total_units_sold')
    .eq('shop_id', shopId)

  if (error || !data?.length) return emptySales()

  return data.reduce<ShopSalesSnapshot>(
    (acc, row) => ({
      totalOrders: acc.totalOrders + (row.total_orders ?? 0),
      totalRevenue: acc.totalRevenue + Number(row.total_revenue ?? 0),
      uniqueCustomers: Math.max(acc.uniqueCustomers, row.unique_customers ?? 0),
      totalUnitsSold: acc.totalUnitsSold + (row.total_units_sold ?? 0),
    }),
    emptySales(),
  )
}

export async function fetchShopDashboard(shopId: string): Promise<ShopDashboardData> {
  const [summary, sales, statsResult] = await Promise.all([
    fetchShopListingsSummary(shopId),
    fetchShopSalesSnapshot(shopId),
    supabase.rpc('get_shop_stats', { shop_id_param: shopId }),
  ])

  return {
    summary,
    sales,
    stats: statsResult.error ? null : (statsResult.data as Record<string, unknown> | null),
  }
}

export async function fetchSellerListings(
  shopId: string,
  options?: {
    status?: ListingStatus | 'all'
    search?: string
    limit?: number
    offset?: number
  },
): Promise<SellerListingRow[]> {
  const status = options?.status && options.status !== 'all' ? options.status : undefined

  const { data, error } = await supabase.rpc('get_shop_listings', {
    p_shop_id: shopId,
    p_listing_status: status,
    p_is_active: status === 'active' ? true : undefined,
    p_limit: options?.limit ?? 100,
    p_offset: options?.offset ?? 0,
    p_search_term: options?.search?.trim() || undefined,
  })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    price: Number(row.price),
    quantity: row.quantity,
    listingType: row.listing_type,
    listingStatus: row.listing_status,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    primaryImageUrl: row.primary_image_url,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }))
}
