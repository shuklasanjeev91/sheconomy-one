import { getListingCardTitle } from '~/lib/format'
import { getListingImageUrls, normalizeListingImageUrl } from '~/commerce/lib/listing-images'
import { resolveCategoryListingIdConstraint } from '~/commerce/lib/category-facets'
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
import { formatShopLocation, normalizeShopAddress } from '~/commerce/lib/shop-location'
import { supabase } from '~/lib/supabase/client'

import { BRAND_NAME } from '~/config/brand'

export { getCategorySlug, getListingSlug, getShopSlug } from '~/commerce/lib/seo-urls'

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
  listing_type: string
  average_rating: number | null
  total_reviews: number | null
  image_url: string | null
  image_urls: string[]
  images: ListingImageSummary[]
  shop_name: string | null
  shop_id?: string | null
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
  category_id: string
  category: string
  category_image_url: string | null
  category_icon: string | null
  product_count: number | null
  seo_name: string | null
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
  listing_type: string
  average_rating: number | null
  total_reviews: number | null
  shop_id?: string | null
  category?: string | null
  created_at?: string | null
  is_featured?: boolean
  shipping_required?: boolean | null
  listing_metadata?: unknown
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

const DELIVERY_PROFILE_FIELDS = `
  id,
  profile_name,
  processing_time_min,
  processing_time_max,
  fixed_fee,
  free_shipping_threshold,
  shipping_rate_type,
  delivery_metadata,
  is_default,
  is_active
`

/** Catalog feeds — only listings that have at least one image row. */
const LISTING_CATALOG_SELECT = `
  id,
  slug,
  title,
  meta_title,
  description,
  price,
  listing_type,
  average_rating,
  total_reviews,
  shop_id,
  category,
  created_at,
  is_featured,
  shipping_required,
  listing_metadata,
  listing_images!inner(${LISTING_IMAGE_FIELDS}),
  listing_delivery_profiles(
    delivery_profiles(${DELIVERY_PROFILE_FIELDS})
  ),
  shops(
    shop_name,
    shop_currency,
    average_rating,
    total_reviews,
    verified,
    shop_metadata,
    shop_addresses(city, state, country, latitude, longitude),
    delivery_profiles(${DELIVERY_PROFILE_FIELDS}),
    shipping_providers(id, provider_name, provider_type, is_primary, is_active, configuration),
    shop_shipping_accounts(provider, status),
    shipping_rates(delivery_days_min, delivery_days_max, zone_name, is_active, shipping_provider_id)
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
    listing_type: listing.listing_type,
    average_rating: listing.average_rating,
    total_reviews: listing.total_reviews,
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    images,
    shop_name: listing.shops?.shop_name ?? null,
    shop_id: listing.shop_id ?? null,
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
    .select(LISTING_CATALOG_SELECT)
    .in('id', ids)
    .eq('is_active', true)
    .eq('listing_status', 'active')

  if (error || !data?.length) return []

  const byId = new Map((data as ListingRow[]).map((row) => [row.id, mapListingRow(row)]))
  return ids.map((id) => byId.get(id)).filter((item): item is ListingSummary => !!item)
}

export async function fetchListingSlugMap(
  ids: string[],
): Promise<Map<string, string>> {
  if (!ids.length) return new Map()

  const { data } = await supabase
    .from('listings')
    .select('id, slug, title')
    .in('id', ids)

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

const DEFAULT_STATS: CommerceStats = {
  total_active_listings: 0,
  shops_with_listings: 0,
  total_featured_listings: 0,
  new_listings_this_week: 0,
  physical_listings: 0,
  digital_listings: 0,
}

const ACTIVE_LISTING_FILTER = {
  is_active: true,
  listing_status: 'active' as const,
}

let trendingIdsPromise: Promise<string[]> | null = null
let recommendedIdsPromise: Promise<string[]> | null = null

async function getTrendingListingIds(): Promise<string[]> {
  if (!trendingIdsPromise) {
    trendingIdsPromise = supabase
      .rpc('get_marketplace_trending_listings', { max_results: 1000 })
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
    { max_results: 1000 },
  )

  if (!recommendedError && recommended?.length) {
    return recommended.map((row) => row.id)
  }

  const [trendingResult, bestsellerResult, ratedResult] = await Promise.all([
    supabase.rpc('get_marketplace_trending_listings', { max_results: 400 }),
    supabase.rpc('get_marketplace_bestseller_listings', {
      max_results: 400,
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
      .limit(200),
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

  if (ranked.length) return ranked

  const { data: latest } = await supabase
    .from('listings')
    .select('id')
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
    .order('created_at', { ascending: false })
    .limit(200)

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
    .select(LISTING_CATALOG_SELECT, { count: 'exact' })
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)

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

  const { data, error, count } = await applyListingBrowseFilters(
    query,
    browseFilters,
    kind === 'latest' ? 'newest' : 'relevance',
  ).range(from, to)

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const items = ((data ?? []) as ListingRow[]).map(mapListingRow)
  const total = count ?? 0

  return {
    items,
    page,
    pageSize,
    hasMore: total ? to + 1 < total : items.length === pageSize,
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

/** Full shop directory for browse page — includes address for country filters. */
export async function fetchAllShopsForBrowse(): Promise<{
  items: ShopSummary[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('shops')
    .select(SHOP_BROWSE_SELECT)
    .eq('is_active', true)
    .order('shop_name', { ascending: true })
    .limit(500)

  if (error) {
    return { items: [], error: error.message }
  }

  return {
    items: (data ?? []).map((row) => mapShopSummaryRow(row as ShopSummary & { shop_addresses?: unknown })),
    error: null,
  }
}

export async function fetchShopsPage(
  page: number,
  pageSize = COMMERCE_HORIZONTAL_PAGE_SIZE,
): Promise<PaginatedResult<ShopSummary>> {
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('shops')
    .select(SHOP_BROWSE_SELECT, { count: 'exact' })
    .eq('is_active', true)
    .order('average_rating', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const total = count ?? 0
  return {
    items: (data ?? []).map((row) => mapShopSummaryRow(row as ShopSummary & { shop_addresses?: unknown })),
    page,
    pageSize,
    hasMore: total ? to + 1 < total : (data?.length ?? 0) === pageSize,
    error: null,
  }
}

/** Categories that have at least one active listing (via category_assignments). */
async function fetchAllCategoriesWithActiveListings(): Promise<CategorySummary[]> {
  const { data: assignments, error } = await supabase
    .from('category_assignments')
    .select(
      `
      category_id,
      listings!inner (
        id,
        is_active,
        listing_status
      )
    `,
    )
    .eq('listings.is_active', true)
    .eq('listings.listing_status', 'active')

  if (error || !assignments?.length) return []

  const countByCategory = new Map<string, number>()
  for (const row of assignments) {
    countByCategory.set(row.category_id, (countByCategory.get(row.category_id) ?? 0) + 1)
  }

  const categoryIds = [...countByCategory.keys()]
  if (!categoryIds.length) return []

  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('category_id, category, category_image_url, category_icon, product_count, seo_name')
    .in('category_id', categoryIds)
    .eq('status', 'A')
    .not('category', 'ilike', '%without category%')

  if (categoriesError || !categories?.length) return []

  return categories
    .filter(isStorefrontCategoryVisible)
    .map((category) => ({
      ...category,
      product_count: countByCategory.get(category.category_id) ?? category.product_count,
    }))
    .sort((a, b) => (b.product_count ?? 0) - (a.product_count ?? 0))
}

export async function fetchCategoriesPage(
  page: number,
  pageSize = COMMERCE_HORIZONTAL_PAGE_SIZE,
): Promise<PaginatedResult<CategorySummary>> {
  const categories = await fetchAllCategoriesWithActiveListings()
  return paginated(categories, page, pageSize)
}

async function collectListingImageUrls(
  kind: ListingFeedKind,
  limit = 6,
): Promise<string[]> {
  const feed = await fetchListingFeedPage(kind, 0, { pageSize: Math.max(limit * 2, 12) })
  const urls: string[] = []
  for (const listing of feed.items) {
    const url = listing.image_urls?.[0] ?? listing.image_url
    if (url && !urls.includes(url)) urls.push(url)
    if (urls.length >= limit) break
  }
  return urls
}

async function collectShopLogoUrls(limit = 6): Promise<string[]> {
  const shops = await fetchShopsPage(0, Math.max(limit * 2, 12))
  const urls: string[] = []
  for (const shop of shops.items) {
    if (shop.logo_url && !urls.includes(shop.logo_url)) urls.push(shop.logo_url)
    if (urls.length >= limit) break
  }
  return urls
}

export async function fetchHomeHeroImages(): Promise<HomeHeroImageSet> {
  const [shops, physical, digital, trending] = await Promise.all([
    collectShopLogoUrls(6),
    collectListingImageUrls('physical', 6),
    collectListingImageUrls('digital', 6),
    collectListingImageUrls('trending', 6),
  ])

  return {
    shops,
    physical,
    digital,
    trending,
    sell: shops.length ? shops : trending,
  }
}

export async function fetchHomeBootstrap(): Promise<{
  data: HomeBootstrapData | null
  error: string | null
}> {
  const [{ data: statsRow, error }, heroImages] = await Promise.all([
    supabase.from('marketplace_statistics').select('*').maybeSingle(),
    fetchHomeHeroImages(),
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

  return { data: { stats, heroImages }, error: null }
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
    return { data: bySeo, error: null }
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

  return { data: byId, error: null }
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

  const listingIdConstraint = await resolveCategoryListingIdConstraint(categoryIds, {
    onSale: filters?.onSale,
    variants: filters?.variants,
  })

  if (listingIdConstraint && !listingIdConstraint.length) {
    return { items: [], page, pageSize, hasMore: false, error: null }
  }

  let baseQuery = supabase
    .from('listings')
    .select(`${LISTING_CATALOG_SELECT}, category_assignments!inner(category_id)`, { count: 'exact' })
    .in('category_assignments.category_id', categoryIds)
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)

  if (listingIdConstraint) {
    baseQuery = baseQuery.in('id', listingIdConstraint)
  }

  if (filters?.shopIds?.length) {
    baseQuery = baseQuery.in('shop_id', filters.shopIds)
  }

  const { data, error, count } = await applyListingBrowseFilters(baseQuery, filters).range(from, to)

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const items = ((data ?? []) as ListingRow[]).map(mapListingRow)
  const total = count ?? 0

  return {
    items,
    page,
    pageSize,
    hasMore: total ? to + 1 < total : items.length === pageSize,
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

function applyListingBrowseFilters<
  T extends {
    eq: (col: string, val: unknown) => T
    gte: (col: string, val: unknown) => T
    lte: (col: string, val: unknown) => T
    order: (
      col: string,
      opts: { ascending: boolean; nullsFirst?: boolean },
    ) => T
  },
>(query: T, filters?: ListingBrowseFilters, defaultSort: ListingSort = 'newest'): T {
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
