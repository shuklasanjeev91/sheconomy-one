import { getListingCardTitle } from '~/lib/format'
import {
  getListingImageUrls,
  hasListingImages,
  normalizeListingImageUrl,
} from '~/commerce/lib/listing-images'
import { resolveCategoryListingIdConstraint } from '~/commerce/lib/category-facets'
import { categoryTreeFilter, fetchCategoryTreeIds } from '~/commerce/lib/category-tree'
import {
  getListingOrderColumn,
  sortListings,
  type ListingBrowseFilters,
  type ListingSort,
} from '~/commerce/lib/filters'
import { getCategorySlug, getListingSlug } from '~/commerce/lib/seo-urls'
import type { DeliveryProfile } from '~/commerce/lib/listing-fulfillment'
import {
  buildShopShippingSummary,
  mapJoinedDeliveryProfiles,
  type ShopShippingSummary,
} from '~/commerce/lib/shop-shipping'
import { isStorefrontCategoryVisible } from '~/commerce/lib/category-visibility'
import { ACTIVE_LISTING_FILTER } from '~/commerce/lib/listing-visibility'
import { formatShopLocation, normalizeShopAddress } from '~/commerce/lib/shop-location'
import { supabase } from '~/lib/supabase/client'

import { BRAND_NAME } from '~/config/brand'

export { getCategorySlug, getListingSlug, getShopSlug } from '~/commerce/lib/seo-urls'
export {
  ACTIVE_LISTING_FILTER,
  ACTIVE_LISTING_STATUS,
  fetchActiveListingIdSet,
  isListingStorefrontVisible,
  type ListingVisibilityFields,
} from '~/commerce/lib/listing-visibility'

export type ShopSummary = {
  id: string
  shop_name: string
  slug: string | null
  logo_url: string | null
  shop_description: string | null
  average_rating: number | null
  total_reviews: number | null
  verified: boolean
  shop_currency: string
  city?: string | null
  state?: string | null
  country?: string | null
  location_label?: string | null
}

export type ListingImageSummary = {
  id: string
  image_url: string
  is_primary: boolean
  display_order: number
  alt_text: string | null
}

export type ListingSummary = {
  id: string
  slug: string | null
  title: string
  card_title: string
  price: number
  mrp?: number | null
  price_includes_tax?: boolean | null
  tax_percent?: number | null
  product_info?: unknown
  listing_type: string
  quantity?: number | null
  listing_status?: string | null
  has_variations?: boolean
  variation_in_stock_count?: number | null
  average_rating: number | null
  total_reviews: number | null
  image_url: string | null
  image_urls: string[]
  images: ListingImageSummary[]
  shop_name: string | null
  shop_id?: string | null
  shop_slug?: string | null
  shop_owner_user_id?: string | null
  category?: string | null
  created_at?: string | null
  currency: string
  is_featured?: boolean
  shop_rating?: number | null
  shop_review_count?: number | null
  shop_verified?: boolean
  shop_address?: {
    city?: string | null
    state?: string | null
    country?: string | null
    latitude?: number | null
    longitude?: number | null
  } | null
  shipping_required?: boolean | null
  listing_metadata?: unknown
  listing_delivery_profiles?: DeliveryProfile[]
  shop_shipping?: ShopShippingSummary | null
}

export type CategorySummary = {
  /** Same as category_id — required by paginated feed merge. */
  id: string
  category_id: string
  category: string
  category_image_url: string | null
  category_icon: string | null
  product_count: number | null
  seo_name: string | null
  parent_id?: string | null
  /** Parent category name when this row is a subcategory. */
  parent_category?: string | null
}

export type ListingTypeFilter = 'physical' | 'digital'

export type CommerceStats = {
  total_active_listings: number
  shops_with_listings: number
  total_featured_listings: number
  new_listings_this_week: number
  physical_listings: number
  digital_listings: number
}

type ListingRow = {
  id: string
  slug?: string | null
  title: string
  meta_title?: string | null
  description?: string | null
  price: number
  mrp?: number | null
  price_includes_tax?: boolean | null
  tax_percent?: number | null
  product_info?: unknown
  listing_type: string
  quantity?: number | null
  listing_status?: string | null
  average_rating: number | null
  total_reviews: number | null
  shop_id?: string | null
  category?: string | null
  created_at?: string | null
  is_featured?: boolean
  shipping_required?: boolean | null
  listing_metadata?: unknown
  listing_variations?: Array<{ stock: number | null }> | null
  listing_delivery_profiles?: Array<{ delivery_profiles: DeliveryProfile | null }> | null
  listing_images: Array<{
    id: string
    image_url: string
    is_primary: boolean
    display_order: number
    alt_text: string | null
    image_metadata?: unknown
  }> | null
  shops: {
    shop_name: string
    shop_currency: string
    slug?: string | null
    user_id?: string | null
    average_rating?: number | null
    total_reviews?: number | null
    verified?: boolean
    shop_metadata?: unknown
    shop_addresses?: {
      city?: string | null
      state?: string | null
      country?: string | null
      latitude?: number | null
      longitude?: number | null
    } | Array<{
      city?: string | null
      state?: string | null
      country?: string | null
      latitude?: number | null
      longitude?: number | null
    }> | null
    delivery_profiles?: DeliveryProfile[] | null
    shipping_providers?: Array<{
      id: string
      provider_name: string
      provider_type: string
      is_primary?: boolean | null
      is_active?: boolean | null
      configuration?: unknown
    }> | null
    shop_shipping_accounts?: Array<{
      provider: string
      status?: string | null
    }> | null
    shipping_rates?: Array<{
      delivery_days_min: number | null
      delivery_days_max: number | null
      zone_name: string
      is_active?: boolean | null
      shipping_provider_id?: string | null
    }> | null
  } | null
}

const LISTING_IMAGE_FIELDS = `
  id,
  image_url,
  is_primary,
  display_order,
  alt_text,
  image_metadata
`

/**
 * Ultra-light card hydrate for recommendation rails / by-id lookups.
 * Require at least one listing_images row — storefront cards without photos
 * render as empty placeholders (home grids already use !inner).
 */
const LISTING_CARD_SELECT = `
  id,
  slug,
  title,
  meta_title,
  price,
  mrp,
  price_includes_tax,
  tax_percent,
  listing_type,
  quantity,
  listing_status,
  average_rating,
  total_reviews,
  shop_id,
  category,
  created_at,
  is_featured,
  shipping_required,
  listing_metadata,
  listing_variations(stock),
  listing_images!inner(id, image_url, is_primary, display_order, alt_text, image_metadata),
  shops!inner(
    shop_name,
    shop_currency,
    slug,
    user_id,
    average_rating,
    total_reviews,
    verified,
    is_active
  )
`

/** Single listing fetch — includes listings without images (PDP placeholder). */
export const LISTING_DETAIL_SELECT = `
  id,
  slug,
  title,
  meta_title,
  description,
  price,
  mrp,
  price_includes_tax,
  tax_percent,
  product_info,
  listing_type,
  average_rating,
  total_reviews,
  is_featured,
  listing_images(${LISTING_IMAGE_FIELDS}),
  shops(shop_name, shop_currency)
`

export function sortListingImages(
  images: ListingRow['listing_images'],
): NonNullable<ListingRow['listing_images']> {
  if (!images?.length) return []

  return [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return a.display_order - b.display_order
  })
}

export function pickListingImage(
  images: ListingRow['listing_images'],
): string | null {
  return sortListingImages(images)[0]?.image_url ?? null
}

export function mapListingImages(
  images: ListingRow['listing_images'],
): ListingImageSummary[] {
  const seen = new Set<string>()
  const mapped: ListingImageSummary[] = []

  for (const image of sortListingImages(images)) {
    const imageUrl = normalizeListingImageUrl(image.image_url, image.image_metadata)
    if (!imageUrl || seen.has(imageUrl)) continue

    seen.add(imageUrl)
    mapped.push({
      id: image.id,
      image_url: imageUrl,
      is_primary: image.is_primary,
      display_order: image.display_order,
      alt_text: image.alt_text,
    })
  }

  return mapped
}

export function mapListingRow(listing: ListingRow): ListingSummary {
  const images = mapListingImages(listing.listing_images)
  const variations = listing.listing_variations ?? []
  const hasVariations = variations.length > 0
  const variationInStockCount = hasVariations
    ? variations.filter((row) => (row.stock ?? 0) > 0).length
    : null
  const imageUrls = getListingImageUrls(
    images.map((image) => image.image_url),
    images[0]?.image_url,
  )
  const cardTitle = getListingCardTitle(listing)
  const shopAddresses = listing.shops?.shop_addresses
  const shopAddress = Array.isArray(shopAddresses) ? shopAddresses[0] : shopAddresses
  const listingDeliveryProfiles = mapJoinedDeliveryProfiles(listing.listing_delivery_profiles)
  const shopShipping = listing.shops
    ? buildShopShippingSummary({
        shop_metadata: listing.shops.shop_metadata,
        delivery_profiles: listing.shops.delivery_profiles,
        shipping_providers: listing.shops.shipping_providers,
        shop_shipping_accounts: listing.shops.shop_shipping_accounts,
        shipping_rates: listing.shops.shipping_rates,
        shop_addresses: shopAddress,
      })
    : null

  return {
    id: listing.id,
    slug: listing.slug ?? null,
    title: listing.title,
    card_title: cardTitle,
    price: listing.price,
    mrp: listing.mrp ?? null,
    price_includes_tax: listing.price_includes_tax ?? true,
    tax_percent: listing.tax_percent ?? null,
    product_info: listing.product_info ?? null,
    listing_type: listing.listing_type,
    quantity: listing.quantity ?? null,
    listing_status: listing.listing_status ?? null,
    has_variations: hasVariations,
    variation_in_stock_count: variationInStockCount,
    average_rating: listing.average_rating,
    total_reviews: listing.total_reviews,
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    images,
    shop_name: listing.shops?.shop_name ?? null,
    shop_id: listing.shop_id ?? null,
    shop_slug: listing.shops?.slug ?? null,
    shop_owner_user_id: listing.shops?.user_id ?? null,
    category: listing.category ?? null,
    created_at: listing.created_at ?? null,
    currency: listing.shops?.shop_currency ?? 'INR',
    is_featured: listing.is_featured,
    shop_rating: listing.shops?.average_rating ?? null,
    shop_review_count: listing.shops?.total_reviews ?? null,
    shop_verified: listing.shops?.verified ?? false,
    shop_address: shopAddress ?? null,
    shipping_required: listing.shipping_required ?? null,
    listing_metadata: listing.listing_metadata ?? null,
    listing_delivery_profiles: listingDeliveryProfiles,
    shop_shipping: shopShipping,
  }
}

export async function fetchListingsByIds(ids: string[]): Promise<ListingSummary[]> {
  if (!ids.length) return []

  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_CARD_SELECT)
    .in('id', ids)
    .eq('is_active', true)
    .eq('listing_status', 'active')
    .eq('shops.is_active', true)
    .eq('shops.verified', true)

  if (error || !data?.length) return []

  const byId = new Map((data as ListingRow[]).map((row) => [row.id, mapListingRow(row)]))
  return ids
    .map((id) => byId.get(id))
    .filter((item): item is ListingSummary => !!item)
    .filter((item) => hasListingImages(item.image_urls, item.image_url))
}

type ActiveListingCardFilters = {
  shopId?: string | null
  category?: string | null
  listingType?: string | null
  excludeId?: string | null
  limit?: number
  orderBy?: 'created_at' | 'average_rating'
}

/** Increase query window so post-filters (exclude id / invalid urls) still fill the rail. */
export async function fetchActiveListingCards(
  filters: ActiveListingCardFilters,
): Promise<ListingSummary[]> {
  const limit = filters.limit ?? 8
  let query = supabase
    .from('listings')
    .select(LISTING_CARD_SELECT)
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
    .eq('shops.is_active', true)
    .eq('shops.verified', true)
    .limit(limit + (filters.excludeId ? 2 : 0))

  if (filters.shopId) query = query.eq('shop_id', filters.shopId)
  if (filters.category?.trim()) query = query.eq('category', filters.category.trim())
  if (filters.listingType) query = query.eq('listing_type', filters.listingType)
  if (filters.excludeId) query = query.neq('id', filters.excludeId)

  if (filters.orderBy === 'average_rating') {
    query = query.order('average_rating', { ascending: false, nullsFirst: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query
  if (error || !data?.length) return []

  return (data as ListingRow[])
    .map(mapListingRow)
    .filter((item) => item.id !== filters.excludeId)
    .filter((item) => hasListingImages(item.image_urls, item.image_url))
    .slice(0, limit)
}

export async function fetchListingSlugMap(
  ids: string[],
): Promise<Map<string, string>> {
  if (!ids.length) return new Map()

  const { data } = await supabase
    .from('listings')
    .select('id, slug, title')
    .in('id', ids)
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.id, getListingSlug(row))
  }
  return map
}

export type ListingFeedKind = 'physical' | 'digital' | 'latest' | 'featured' | 'trending' | 'shop'

export const BROWSE_FEED_KINDS = [
  'physical',
  'digital',
  'latest',
  'featured',
  'trending',
] as const

export type BrowseFeedKind = (typeof BROWSE_FEED_KINDS)[number]

export const BROWSE_FEED_LABELS: Record<BrowseFeedKind, { title: string; subtitle?: string }> = {
  physical: { title: 'Ships to you', subtitle: 'Physical items ready to ship' },
  digital: { title: 'Instant delivery', subtitle: 'Digital downloads & services' },
  latest: { title: 'New arrivals', subtitle: 'Fresh listings from sellers' },
  featured: { title: 'Recommended for you', subtitle: 'Ranked by your activity, location, and demand' },
  trending: { title: 'Popular right now', subtitle: `Trending on ${BRAND_NAME}` },
}

export function isBrowseFeedKind(value: string): value is BrowseFeedKind {
  return (BROWSE_FEED_KINDS as readonly string[]).includes(value)
}

export const COMMERCE_PAGE_SIZE = 24
export const COMMERCE_HORIZONTAL_PAGE_SIZE = 12
/** Home category rail page size (categories + subcategories mixed). */
export const CATEGORY_RAIL_PAGE_SIZE = 20

/** Enough IDs for ~4 feed pages without pulling the entire catalog ranking. */
const FEED_RANKING_ID_LIMIT = 96

export type PaginatedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  hasMore: boolean
  error: string | null
}

export type HomeHeroImageSet = {
  shops: string[]
  physical: string[]
  digital: string[]
  trending: string[]
  sell: string[]
}

export type HomeBootstrapData = {
  stats: CommerceStats
  heroImages: HomeHeroImageSet
}

export type HomeBootstrapFeedSeeds = {
  shops: PaginatedResult<ShopSummary>
  physical: PaginatedResult<ListingSummary>
  digital: PaginatedResult<ListingSummary>
  trending: PaginatedResult<ListingSummary>
}

const DEFAULT_STATS: CommerceStats = {
  total_active_listings: 0,
  shops_with_listings: 0,
  total_featured_listings: 0,
  new_listings_this_week: 0,
  physical_listings: 0,
  digital_listings: 0,
}

let trendingIdsPromise: Promise<string[]> | null = null
let recommendedIdsPromise: Promise<string[]> | null = null

async function getTrendingListingIds(): Promise<string[]> {
  if (!trendingIdsPromise) {
    trendingIdsPromise = supabase
      .rpc('get_marketplace_trending_listings', { max_results: FEED_RANKING_ID_LIMIT })
      .then(({ data, error }) => {
        if (error) return []
        return (data ?? []).map((row) => row.id)
      })
  }

  return trendingIdsPromise
}

async function buildRecommendedListingIds(): Promise<string[]> {
  const { data: recommended, error: recommendedError } = await supabase.rpc(
    'get_marketplace_recommended_listings',
    { max_results: FEED_RANKING_ID_LIMIT },
  )

  if (!recommendedError && recommended?.length) {
    return recommended.map((row) => row.id)
  }

  const [trendingResult, bestsellerResult, ratedResult] = await Promise.all([
    supabase.rpc('get_marketplace_trending_listings', { max_results: FEED_RANKING_ID_LIMIT }),
    supabase.rpc('get_marketplace_bestseller_listings', {
      max_results: FEED_RANKING_ID_LIMIT,
      min_orders: 2,
    }),
    supabase
      .from('listings')
      .select('id, average_rating, total_reviews')
      .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
      .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
      .gte('average_rating', 4)
      .gte('total_reviews', 2)
      .order('average_rating', { ascending: false, nullsFirst: false })
      .limit(FEED_RANKING_ID_LIMIT),
  ])

  const scores = new Map<string, number>()
  const addScore = (id: string, points: number) => {
    scores.set(id, (scores.get(id) ?? 0) + points)
  }

  ;(trendingResult.data ?? []).forEach((row, index) => {
    addScore(row.id, 100 - index * 0.15 + (row.trending_score ?? 0))
    if (row.order_count) addScore(row.id, Math.log10(row.order_count + 1) * 4)
  })

  ;(bestsellerResult.data ?? []).forEach((row, index) => {
    addScore(row.id, 90 - index * 0.12)
    if (row.order_count) addScore(row.id, Math.log10(row.order_count + 1) * 6)
  })

  ;(ratedResult.data ?? []).forEach((row, index) => {
    addScore(
      row.id,
      40 - index * 0.1 + (row.average_rating ?? 0) * (row.total_reviews ?? 0) * 0.05,
    )
  })

  const ranked = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, FEED_RANKING_ID_LIMIT)

  if (ranked.length) return ranked

  const { data: latest } = await supabase
    .from('listings')
    .select('id')
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
    .order('created_at', { ascending: false })
    .limit(FEED_RANKING_ID_LIMIT)

  return (latest ?? []).map((row) => row.id)
}

async function getRecommendedListingIds(): Promise<string[]> {
  if (!recommendedIdsPromise) {
    recommendedIdsPromise = buildRecommendedListingIds()
  }

  return recommendedIdsPromise
}

function paginated<T>(
  items: T[],
  page: number,
  pageSize: number,
  error: string | null = null,
): PaginatedResult<T> {
  const from = page * pageSize
  const slice = items.slice(from, from + pageSize)
  return {
    items: slice,
    page,
    pageSize,
    hasMore: from + pageSize < items.length,
    error,
  }
}

export async function fetchListingFeedPage(
  kind: ListingFeedKind,
  page: number,
  options?: {
    pageSize?: number
    shopId?: string
    listingType?: ListingTypeFilter
    filters?: ListingBrowseFilters
  },
): Promise<PaginatedResult<ListingSummary>> {
  const pageSize = options?.pageSize ?? COMMERCE_PAGE_SIZE
  const from = page * pageSize
  const to = from + pageSize - 1

  if (kind === 'trending') {
    const ids = await getTrendingListingIds()
    const slice = ids.slice(from, to + 1)
    const items = await fetchListingsByIds(slice)

    if (!items.length && page === 0) {
      return fetchListingFeedPage('latest', page, options)
    }

    return {
      items,
      page,
      pageSize,
      hasMore: to + 1 < ids.length,
      error: null,
    }
  }

  if (kind === 'featured') {
    const ids = await getRecommendedListingIds()
    const slice = ids.slice(from, to + 1)
    const items = await fetchListingsByIds(slice)

    if (!items.length && page === 0) {
      return fetchListingFeedPage('latest', page, options)
    }

    return {
      items,
      page,
      pageSize,
      hasMore: to + 1 < ids.length,
      error: null,
    }
  }

  let query = supabase
    .from('listings')
    .select(LISTING_CARD_SELECT)
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
    .eq('shops.is_active', true)
    .eq('shops.verified', true)

  if (kind === 'physical' || options?.listingType === 'physical') {
    query = query.eq('listing_type', 'physical')
  } else if (kind === 'digital' || options?.listingType === 'digital') {
    query = query.eq('listing_type', 'digital')
  } else if (kind === 'shop') {
    if (!options?.shopId) {
      return { items: [], page, pageSize, hasMore: false, error: 'Shop not found' }
    }
    query = query.eq('shop_id', options.shopId)
  }

  const browseFilters: ListingBrowseFilters = { ...options?.filters }
  if (kind === 'physical' || kind === 'digital') {
    delete browseFilters.listingType
  }

  const { data, error } = await applyListingBrowseFilters(
    query as unknown as BrowseFilterQuery,
    browseFilters,
    kind === 'latest' ? 'newest' : 'relevance',
  ).range(from, to)

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const items = ((data ?? []) as ListingRow[]).map(mapListingRow)

  return {
    items,
    page,
    pageSize,
    hasMore: items.length === pageSize,
    error: null,
  }
}

const SHOP_BROWSE_SELECT =
  'id, shop_name, slug, logo_url, shop_description, average_rating, total_reviews, verified, shop_currency, shop_addresses(city, state, country)'

function toNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapShopSummaryRow(
  row: ShopSummary & { shop_addresses?: unknown },
): ShopSummary {
  const address = normalizeShopAddress(row.shop_addresses)
  const { shop_addresses: _address, ...shop } = row
  return {
    ...shop,
    average_rating: toNullableNumber(shop.average_rating),
    total_reviews: toNullableNumber(shop.total_reviews),
    city: address?.city ?? null,
    state: address?.state ?? null,
    country: address?.country ?? null,
    location_label: formatShopLocation(address),
  }
}

export type ShopBrowsePageFilters = {
  sort?:
    | 'name_asc'
    | 'name_desc'
    | 'rating_high'
    | 'rating_low'
    | 'country_asc'
    | 'country_desc'
  /** Raw shop country value (code or name); `all` / empty = no filter. */
  country?: string
}

/** Paginated shop directory for browse — no hard cap; load via infinite scroll. */
export async function fetchShopsBrowsePage(
  page: number,
  pageSize = COMMERCE_PAGE_SIZE,
  filters: ShopBrowsePageFilters = {},
): Promise<PaginatedResult<ShopSummary> & { totalCount: number }> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sort = filters.sort ?? 'rating_high'
  const country = filters.country && filters.country !== 'all' ? filters.country : null

  const select = country
    ? 'id, shop_name, slug, logo_url, shop_description, average_rating, total_reviews, verified, shop_currency, shop_addresses!inner(city, state, country)'
    : SHOP_BROWSE_SELECT

  let query = supabase.from('shops').select(select).eq('is_active', true)

  if (country) {
    query = query.eq('shop_addresses.country', country)
  }

  switch (sort) {
    case 'name_asc':
      query = query.order('shop_name', { ascending: true })
      break
    case 'name_desc':
      query = query.order('shop_name', { ascending: false })
      break
    case 'rating_low':
      query = query
        .order('average_rating', { ascending: true, nullsFirst: false })
        .order('total_reviews', { ascending: true, nullsFirst: false })
      break
    case 'country_asc':
    case 'country_desc':
      // Nested address sort is unreliable; fall back to name then filter client-side labels.
      query = query.order('shop_name', { ascending: sort === 'country_asc' })
      break
    case 'rating_high':
    default:
      query = query
        .order('average_rating', { ascending: false, nullsFirst: false })
        .order('total_reviews', { ascending: false, nullsFirst: false })
      break
  }

  const { data, error } = await query.range(from, to)

  if (error) {
    return {
      items: [],
      page,
      pageSize,
      hasMore: false,
      error: error.message,
      totalCount: 0,
    }
  }

  const items = (data ?? []).map((row) =>
    mapShopSummaryRow(row as ShopSummary & { shop_addresses?: unknown }),
  )

  return {
    items,
    page,
    pageSize,
    hasMore: items.length === pageSize,
    error: null,
    totalCount: items.length,
  }
}

/** @deprecated Prefer fetchShopsBrowsePage — kept for callers that need a one-shot sample. */
export async function fetchAllShopsForBrowse(): Promise<{
  items: ShopSummary[]
  error: string | null
}> {
  const result = await fetchShopsBrowsePage(0, COMMERCE_PAGE_SIZE)
  return { items: result.items, error: result.error }
}

export async function fetchShopsPage(
  page: number,
  pageSize = COMMERCE_HORIZONTAL_PAGE_SIZE,
): Promise<PaginatedResult<ShopSummary>> {
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data, error } = await supabase
    .from('shops')
    .select(SHOP_BROWSE_SELECT)
    .eq('is_active', true)
    .order('average_rating', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const items = (data ?? []).map((row) =>
    mapShopSummaryRow(row as ShopSummary & { shop_addresses?: unknown }),
  )
  return {
    items,
    page,
    pageSize,
    hasMore: items.length === pageSize,
    error: null,
  }
}

/**
 * Only curated artwork from the `categories_media` bucket is a category image.
 * A backfill seeded `categories.category_image_url` from listing photos whose
 * title matched the category name, so every other host is a product photo and
 * has to fall back to the category icon.
 */
function categoryArtworkUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.includes('/categories_media/') ? url : null
}

/**
 * Storefront-visible listings anywhere in a category's tree. Assignments land
 * on leaf categories, so a root only has a count once its children are rolled
 * up. Mirrors the fetchCategoryListingsPage filters so the tile count matches
 * what the category page renders.
 */
async function countCategoryTreeListings(categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('listings')
    .select(
      'id, listing_images!inner(id), shops!inner(id), category_assignments!inner(categories!inner(id_path))',
      { count: 'exact', head: true },
    )
    .or(categoryTreeFilter(categoryId), { referencedTable: 'category_assignments.categories' })
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
    .eq('shops.is_active', true)
    .eq('shops.verified', true)

  if (error) return 0
  return count ?? 0
}

const STOREFRONT_CATEGORY_TTL_MS = 5 * 60 * 1000
let storefrontCategoryCache: { items: CategorySummary[]; expiresAt: number } | null = null

type CategoryRailRow = {
  category_id: string
  category: string
  category_image_url: string | null
  category_icon: string | null
  seo_name: string | null
  parent_id: string | null
  position: number | null
  product_count: number | null
}

function toCategorySummary(
  row: CategoryRailRow,
  parentName: string | null,
): CategorySummary {
  return {
    id: row.category_id,
    category_id: row.category_id,
    category: row.category,
    category_image_url: categoryArtworkUrl(row.category_image_url),
    category_icon: row.category_icon,
    product_count: row.product_count ?? 0,
    seo_name: row.seo_name,
    parent_id: row.parent_id,
    parent_category: parentName,
  }
}

/**
 * Mix root categories with their subcategories for the home rail.
 * Roots need curated artwork; subcategories also need at least one product.
 */
async function loadStorefrontCategories(): Promise<{ items: CategorySummary[]; error: string | null }> {
  if (storefrontCategoryCache && storefrontCategoryCache.expiresAt > Date.now()) {
    return { items: storefrontCategoryCache.items, error: null }
  }

  const [{ data: categoryRows, error: categoryError }, { data: countRows, error: countError }] =
    await Promise.all([
      supabase
        .from('categories')
        .select('category_id, category, category_image_url, category_icon, seo_name, parent_id, position')
        .eq('status', 'A')
        .order('position', { ascending: true })
        .order('category', { ascending: true }),
      supabase.from('categories_with_counts').select('category_id, product_count'),
    ])

  const error = categoryError ?? countError
  if (error) {
    return { items: [], error: error.message }
  }

  const countById = new Map(
    (countRows ?? []).map((row) => [row.category_id ?? '', row.product_count ?? 0]),
  )

  const rows = (categoryRows ?? [])
    .filter((row) =>
      isStorefrontCategoryVisible({ category_id: row.category_id, category: row.category }),
    )
    .map(
      (row): CategoryRailRow => ({
        category_id: row.category_id,
        category: row.category,
        category_image_url: row.category_image_url,
        category_icon: row.category_icon,
        seo_name: row.seo_name,
        parent_id: row.parent_id,
        position: row.position,
        product_count: countById.get(row.category_id) ?? 0,
      }),
    )

  const rowsWithImage = rows.filter((row) => {
    if (!categoryArtworkUrl(row.category_image_url)) return false
    const isSubcategory = Boolean(row.parent_id?.trim())
    if (isSubcategory && (row.product_count ?? 0) <= 0) return false
    return true
  })
  const imageIds = new Set(rowsWithImage.map((row) => row.category_id))

  const byId = new Map(rows.map((row) => [row.category_id, row]))
  const childrenByParent = new Map<string, CategoryRailRow[]>()
  const roots: CategoryRailRow[] = []

  for (const row of rowsWithImage) {
    const parentId = row.parent_id?.trim() || null
    // Treat as a rail root when it has no parent, or parent isn't image-backed.
    if (!parentId || !imageIds.has(parentId)) {
      roots.push(row)
      continue
    }
    const list = childrenByParent.get(parentId) ?? []
    list.push(row)
    childrenByParent.set(parentId, list)
  }

  const items: CategorySummary[] = []
  const seen = new Set<string>()

  function pushRow(row: CategoryRailRow) {
    if (seen.has(row.category_id)) return
    if (!categoryArtworkUrl(row.category_image_url)) return
    if (row.parent_id?.trim() && (row.product_count ?? 0) <= 0) return
    seen.add(row.category_id)
    const parentId = row.parent_id?.trim() || null
    const parentName = parentId ? byId.get(parentId)?.category ?? null : null
    items.push(toCategorySummary(row, parentName))
  }

  function walk(row: CategoryRailRow) {
    pushRow(row)
    for (const child of childrenByParent.get(row.category_id) ?? []) {
      walk(child)
    }
  }

  // Parent → nested children (any depth), then orphans whose parent is missing/hidden.
  for (const root of roots) {
    walk(root)
  }

  for (const row of rowsWithImage) {
    if (!seen.has(row.category_id)) pushRow(row)
  }

  storefrontCategoryCache = { items, expiresAt: Date.now() + STOREFRONT_CATEGORY_TTL_MS }
  return { items, error: null }
}

/** Home category rail — mixed parents + subcategories, load-more paginated. */
export async function fetchCategoriesPage(
  page: number,
  pageSize = CATEGORY_RAIL_PAGE_SIZE,
): Promise<PaginatedResult<CategorySummary>> {
  const { items: categories, error } = await loadStorefrontCategories()

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error }
  }

  const from = page * pageSize
  const items = categories.slice(from, from + pageSize)

  return {
    items,
    page,
    pageSize,
    hasMore: from + items.length < categories.length,
    error: null,
  }
}

function listingImageUrls(items: ListingSummary[], limit = 6): string[] {
  const urls: string[] = []
  for (const listing of items) {
    const url = listing.image_urls?.[0] ?? listing.image_url
    if (url && !urls.includes(url)) urls.push(url)
    if (urls.length >= limit) break
  }
  return urls
}

function shopLogoUrls(items: ShopSummary[], limit = 6): string[] {
  const urls: string[] = []
  for (const shop of items) {
    if (shop.logo_url && !urls.includes(shop.logo_url)) urls.push(shop.logo_url)
    if (urls.length >= limit) break
  }
  return urls
}

function heroImagesFromFeeds(input: {
  shops: ShopSummary[]
  physical: ListingSummary[]
  digital: ListingSummary[]
  trending: ListingSummary[]
}): HomeHeroImageSet {
  const shops = shopLogoUrls(input.shops, 6)
  const physical = listingImageUrls(input.physical, 6)
  const digital = listingImageUrls(input.digital, 6)
  const trending = listingImageUrls(input.trending, 6)
  return {
    shops,
    physical,
    digital,
    trending,
    sell: shops.length ? shops : trending,
  }
}

/** @deprecated Prefer fetchHomeBootstrap — hero images are derived from the same feed queries. */
export async function fetchHomeHeroImages(): Promise<HomeHeroImageSet> {
  const [shops, physical, digital, trending] = await Promise.all([
    fetchShopsPage(0, COMMERCE_HORIZONTAL_PAGE_SIZE),
    fetchListingFeedPage('physical', 0),
    fetchListingFeedPage('digital', 0),
    fetchListingFeedPage('trending', 0),
  ])
  return heroImagesFromFeeds({
    shops: shops.items,
    physical: physical.items,
    digital: digital.items,
    trending: trending.items,
  })
}

export async function fetchHomeBootstrap(): Promise<{
  data: HomeBootstrapData | null
  error: string | null
  feedSeeds?: HomeBootstrapFeedSeeds
}> {
  // One round-trip set: stats + the same feeds the home sections/hero use.
  const [{ data: statsRow, error }, shops, physical, digital, trending] = await Promise.all([
    supabase.from('marketplace_statistics').select('*').maybeSingle(),
    fetchShopsPage(0, COMMERCE_HORIZONTAL_PAGE_SIZE),
    fetchListingFeedPage('physical', 0),
    fetchListingFeedPage('digital', 0),
    fetchListingFeedPage('trending', 0),
  ])

  if (error) {
    return { data: null, error: error.message }
  }

  const stats: CommerceStats = statsRow
    ? {
        total_active_listings: statsRow.total_active_listings ?? 0,
        shops_with_listings: statsRow.shops_with_listings ?? 0,
        total_featured_listings: statsRow.total_featured_listings ?? 0,
        new_listings_this_week: statsRow.new_listings_this_week ?? 0,
        physical_listings: statsRow.physical_listings ?? 0,
        digital_listings: statsRow.digital_listings ?? 0,
      }
    : DEFAULT_STATS

  const heroImages = heroImagesFromFeeds({
    shops: shops.items,
    physical: physical.items,
    digital: digital.items,
    trending: trending.items,
  })

  return {
    data: { stats, heroImages },
    error: null,
    feedSeeds: { shops, physical, digital, trending },
  }
}

/** @deprecated Use fetchHomeBootstrap + paginated section feeds. */
export async function fetchHomeCommerce(): Promise<{
  data: HomeBootstrapData | null
  error: string | null
}> {
  return fetchHomeBootstrap()
}

export async function fetchCategoryBySlug(slug: string): Promise<{
  data: CategorySummary | null
  error: string | null
}> {
  const decoded = decodeURIComponent(slug)

  const { data: bySeo, error: seoError } = await supabase
    .from('categories')
    .select('category_id, category, category_image_url, category_icon, product_count, seo_name')
    .eq('seo_name', decoded)
    .eq('status', 'A')
    .maybeSingle()

  if (seoError) {
    return { data: null, error: seoError.message }
  }

  if (bySeo) {
    if (!isStorefrontCategoryVisible(bySeo)) {
      return { data: null, error: null }
    }
    return { data: await mapCategorySummaryRow(bySeo), error: null }
  }

  const { data: byId, error: idError } = await supabase
    .from('categories')
    .select('category_id, category, category_image_url, category_icon, product_count, seo_name')
    .eq('category_id', decoded)
    .eq('status', 'A')
    .maybeSingle()

  if (idError) {
    return { data: null, error: idError.message }
  }

  if (byId && !isStorefrontCategoryVisible(byId)) {
    return { data: null, error: null }
  }

  return { data: byId ? await mapCategorySummaryRow(byId) : null, error: null }
}

/**
 * `categories.product_count` only counts assignments on that exact category, so
 * a root reads as near-empty while its subcategories hold the catalogue. The
 * page browses the whole tree, so it counts the whole tree.
 */
async function mapCategorySummaryRow(
  row: {
    category_id: string
    category: string
    category_image_url: string | null
    category_icon: string | null
    product_count: number | null
    seo_name: string | null
  },
): Promise<CategorySummary> {
  return {
    id: row.category_id,
    category_id: row.category_id,
    category: row.category,
    category_image_url: categoryArtworkUrl(row.category_image_url),
    category_icon: row.category_icon,
    product_count: await countCategoryTreeListings(row.category_id),
    seo_name: row.seo_name,
  }
}

export async function fetchCategoryListingsPage(
  categoryId: string,
  page: number,
  pageSize = COMMERCE_PAGE_SIZE,
  filters?: ListingBrowseFilters,
): Promise<PaginatedResult<ListingSummary>> {
  const from = page * pageSize
  const to = from + pageSize - 1

  const categoryIds = filters?.categoryIds?.length ? filters.categoryIds : [categoryId]

  // Browsing one category means its whole tree; picking several subcategories
  // from the facet list means exactly those.
  const treeCategoryId = categoryIds.length === 1 ? categoryIds[0] : null

  const listingIdConstraint = await resolveCategoryListingIdConstraint(
    treeCategoryId ? await fetchCategoryTreeIds(treeCategoryId) : categoryIds,
    {
      onSale: filters?.onSale,
      variants: filters?.variants,
    },
  )

  if (listingIdConstraint && !listingIdConstraint.length) {
    return { items: [], page, pageSize, hasMore: false, error: null }
  }

  let baseQuery = supabase
    .from('listings')
    .select(
      treeCategoryId
        ? `${LISTING_CARD_SELECT}, category_assignments!inner(categories!inner(id_path))`
        : `${LISTING_CARD_SELECT}, category_assignments!inner(category_id)`,
    )
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
    .eq('shops.is_active', true)
    .eq('shops.verified', true)

  baseQuery = treeCategoryId
    ? baseQuery.or(categoryTreeFilter(treeCategoryId), {
        referencedTable: 'category_assignments.categories',
      })
    : baseQuery.in('category_assignments.category_id', categoryIds)

  if (listingIdConstraint) {
    baseQuery = baseQuery.in('id', listingIdConstraint)
  }

  if (filters?.shopIds?.length) {
    baseQuery = baseQuery.in('shop_id', filters.shopIds)
  }

  const { data, error } = await applyListingBrowseFilters(
    baseQuery as unknown as BrowseFilterQuery,
    filters,
  ).range(from, to)

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const items = ((data ?? []) as ListingRow[]).map(mapListingRow)

  return {
    items,
    page,
    pageSize,
    hasMore: items.length === pageSize,
    error: null,
  }
}

export type SearchListingsOptions = ListingBrowseFilters & {
  pageSize?: number
}

export type { ListingBrowseFilters, ListingSort } from '~/commerce/lib/filters'
export {
  fetchCategoryFilterFacets,
  getAvailableSortOptions,
  hasCategoryFilterOptions,
  type CategoryFilterFacets,
  type FacetGroup,
  type FacetOption,
} from '~/commerce/lib/category-facets'
export {
  buildListingFulfillmentInfo,
  cartRequiresShipping,
  fetchListingTypesByIds,
  getListingCardFulfillmentLabel,
  isDigitalListing,
  isPhysicalListing,
  type ListingFulfillmentInfo,
} from '~/commerce/lib/listing-fulfillment'

type BrowseFilterQuery = {
  eq: (col: string, val: unknown) => BrowseFilterQuery
  gte: (col: string, val: unknown) => BrowseFilterQuery
  lte: (col: string, val: unknown) => BrowseFilterQuery
  order: (
    col: string,
    opts: { ascending: boolean; nullsFirst?: boolean },
  ) => BrowseFilterQuery
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null; count: number | null }>
}

function applyListingBrowseFilters(
  query: BrowseFilterQuery,
  filters?: ListingBrowseFilters,
  defaultSort: ListingSort = 'newest',
): BrowseFilterQuery {
  let next = query

  if (filters?.listingType) {
    next = next.eq('listing_type', filters.listingType)
  }
  if (filters?.minPrice != null) {
    next = next.gte('price', filters.minPrice)
  }
  if (filters?.maxPrice != null) {
    next = next.lte('price', filters.maxPrice)
  }
  if (filters?.minRating != null) {
    next = next.gte('average_rating', filters.minRating)
  }

  const order = getListingOrderColumn(filters?.sort ?? defaultSort)
  return next.order(order.column, {
    ascending: order.ascending,
    nullsFirst: 'nullsFirst' in order ? order.nullsFirst : undefined,
  })
}

export async function searchListingsPage(
  query: string,
  page: number,
  options?: SearchListingsOptions,
): Promise<PaginatedResult<ListingSummary>> {
  const pageSize = options?.pageSize ?? COMMERCE_PAGE_SIZE
  const trimmed = query.trim()

  if (!trimmed) {
    return { items: [], page, pageSize, hasMore: false, error: null }
  }

  const { data, error } = await supabase.rpc('search_listings', {
    p_search_term: trimmed,
    p_limit: pageSize,
    p_offset: page * pageSize,
    p_listing_type: options?.listingType,
    p_min_price: options?.minPrice,
    p_max_price: options?.maxPrice,
  })

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const rows = data ?? []
  if (!rows.length) {
    return { items: [], page, pageSize, hasMore: false, error: null }
  }

  const ids = rows.map((row) => row.id)
  let items = await fetchListingsByIds(ids)

  if (options?.minRating != null) {
    items = items.filter((item) => (item.average_rating ?? 0) >= options.minRating!)
  }

  if (options?.sort) {
    items = sortListings(items, options.sort)
  }

  return {
    items,
    page,
    pageSize,
    hasMore: rows.length === pageSize,
    error: null,
  }
}
