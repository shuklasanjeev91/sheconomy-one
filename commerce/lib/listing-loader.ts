import type { LoaderProps } from 'one'

import type { DeliveryProfile } from '~/commerce/lib/listing-fulfillment'
import type { ListingAttribute, ListingVariation } from '~/commerce/lib/listing-detail'
import { normalizeListingImageUrl } from '~/commerce/lib/listing-images'
import { isListingStorefrontVisible, ACTIVE_LISTING_FILTER } from '~/commerce/lib/listing-visibility'
import { isUuid, listingSlugMatches, slugifyTitle } from '~/commerce/lib/seo-urls'
import { commerceRoutes } from '~/lib/routes'
import { pageSeo, plainSnippet } from '~/lib/seo/seo-helpers'
import { publishSsrPageSeo } from '~/lib/seo/ssr-page-seo-slot'
import { supabase } from '~/lib/supabase'
import type { Json, Tables } from '~/lib/supabase'

export type ListingDetail = Pick<
  Tables<'listings'>,
  | 'id'
  | 'title'
  | 'description'
  | 'price'
  | 'listing_type'
  | 'listing_status'
  | 'is_active'
  | 'average_rating'
  | 'total_reviews'
  | 'stock'
  | 'quantity'
  | 'category'
  | 'tags'
  | 'shop_id'
  | 'created_at'
  | 'sku'
  | 'weight'
  | 'dimensions'
  | 'listing_metadata'
  | 'mrp'
  | 'price_includes_tax'
  | 'tax_percent'
  | 'product_info'
  | 'digital_file_url'
  | 'digital_file_type'
  | 'digital_file_size'
  | 'download_limit'
  | 'shipping_required'
>

export type ListingImage = Pick<
  Tables<'listing_images'>,
  'id' | 'image_url' | 'is_primary' | 'display_order' | 'alt_text' | 'image_type'
>

export type ListingShop = Pick<
  Tables<'shops'>,
  | 'id'
  | 'shop_name'
  | 'logo_url'
  | 'shop_currency'
  | 'verified'
  | 'slug'
  | 'average_rating'
  | 'total_reviews'
  | 'shop_metadata'
  | 'user_id'
> & {
  delivery_profiles?: DeliveryProfile[] | null
  shipping_providers?: Array<{
    id: string
    provider_name: string
    provider_type: string
    is_primary?: boolean | null
    is_active?: boolean | null
    configuration?: Json | null
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
  shop_addresses?: {
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    latitude?: number | null
    longitude?: number | null
  } | Array<{
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    latitude?: number | null
    longitude?: number | null
  }> | null
}

export type ListingRow = ListingDetail & {
  slug?: string | null
  listing_images: ListingImage[] | null
  listing_variations: ListingVariation[] | null
  listing_attributes: ListingAttribute[] | null
  listing_delivery_profiles: Array<{ delivery_profiles: DeliveryProfile | null }> | null
  shops: ListingShop | null
}

/** First-paint PDP payload — no deep delivery/shipping embeds. */
export const LISTING_CORE_SELECT = `
  id, slug, title, description, price, listing_type, listing_status, is_active,
  average_rating, total_reviews, stock, quantity, category, tags,
  shop_id, created_at, sku, weight, dimensions, listing_metadata,
  mrp, price_includes_tax, tax_percent, product_info,
  digital_file_url, digital_file_type, digital_file_size, download_limit, shipping_required,
  listing_images(id, image_url, is_primary, display_order, alt_text, image_type, image_metadata),
  listing_variations(
    id, variation_name, variation_value, price_adjustment, stock, sku,
    is_available, display_order
  ),
  listing_attributes(
    id, attribute_name, attribute_value, display_order
  ),
  shops(
    id, shop_name, logo_url, shop_currency, verified, slug, shop_metadata, user_id,
    average_rating, total_reviews
  )
`

/** @deprecated Prefer LISTING_CORE_SELECT + fetchShopShippingEnrichment */
export const LISTING_DETAIL_SELECT = LISTING_CORE_SELECT

const SHOP_SHIPPING_SELECT = `
  id,
  shop_address_id,
  shipping_providers(id, provider_name, provider_type, is_primary, is_active, configuration),
  shop_shipping_accounts(provider, status),
  shipping_rates(delivery_days_min, delivery_days_max, zone_name, is_active, shipping_provider_id),
  shop_addresses(city, state, country, postal_code, latitude, longitude)
`

export type ListingLoaderResult = {
  data: ListingRow | null
  error: string | null
}

type ListingIdRow = { id: string; slug?: string | null; title?: string | null }

async function resolveListingId(listingRef: string): Promise<{
  id: string | null
  error: string | null
}> {
  if (isUuid(listingRef)) {
    return { id: listingRef, error: null }
  }

  const idPrefix = listingRef.split('-')[0]
  if (isUuid(idPrefix)) {
    return { id: idPrefix, error: null }
  }

  const active = () =>
    supabase
      .from('listings')
      .select('id, slug, title')
      .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
      .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)

  const bySlug = await active().eq('slug', listingRef).maybeSingle()
  if (bySlug.error) return { id: null, error: bySlug.error.message }
  if (bySlug.data?.id) return { id: bySlug.data.id, error: null }

  const titleGuess = listingRef.replace(/-/g, ' ').trim()
  if (titleGuess) {
    const byTitle = await active().ilike('title', titleGuess).limit(5)
    if (byTitle.error) return { id: null, error: byTitle.error.message }
    const matched =
      byTitle.data?.find((row) => listingSlugMatches(row, listingRef)) ??
      byTitle.data?.find((row) => slugifyTitle(row.title ?? '') === listingRef.toLowerCase()) ??
      byTitle.data?.[0] ??
      null
    if (matched?.id) return { id: matched.id, error: null }

    // Broader title contains — still light columns only
    const byContains = await active().ilike('title', `%${titleGuess}%`).limit(25)
    const containsMatch =
      byContains.data?.find((row) => listingSlugMatches(row as ListingIdRow, listingRef)) ??
      byContains.data?.find(
        (row) => slugifyTitle(row.title ?? '') === listingRef.toLowerCase(),
      ) ??
      null
    if (containsMatch?.id) return { id: containsMatch.id, error: null }
  }

  return { id: null, error: null }
}

async function fetchShopShippingEnrichment(shopId: string): Promise<Partial<ListingShop> | null> {
  const { data, error } = await supabase
    .from('shops')
    .select(SHOP_SHIPPING_SELECT)
    .eq('id', shopId)
    .maybeSingle()

  if (error || !data) return null
  return {
    shipping_providers: data.shipping_providers ?? null,
    shop_shipping_accounts: data.shop_shipping_accounts ?? null,
    shipping_rates: data.shipping_rates ?? null,
    shop_addresses: data.shop_addresses ?? null,
  }
}

async function fetchListingCoreById(id: string): Promise<ListingLoaderResult> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_CORE_SELECT)
    .eq('id', id)
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
    .maybeSingle()

  if (error || !data) {
    return { data: null, error: error?.message ?? 'Listing not found' }
  }

  if (!isListingStorefrontVisible(data)) {
    return { data: null, error: 'Listing not found' }
  }

  return { data: data as ListingRow, error: null }
}

/** Attach shop shipping rails after first paint (separate from core PDP query). */
export async function enrichListingShopShipping(listing: ListingRow): Promise<ListingRow> {
  if (!listing.shop_id || !listing.shops) return listing
  if (
    listing.shops.shipping_providers != null ||
    listing.shops.shipping_rates != null ||
    listing.shops.shop_shipping_accounts != null ||
    listing.shops.shop_addresses != null
  ) {
    return listing
  }

  const shipping = await fetchShopShippingEnrichment(listing.shop_id)
  if (!shipping) return listing
  return {
    ...listing,
    shops: { ...listing.shops, ...shipping },
  }
}

/**
 * Resolve any listing ref (uuid / slug / title-slug) to one core detail fetch.
 * Never runs the nested detail select against unresolved slug/title scans.
 */
export async function fetchListingDetail(listingRef: string): Promise<ListingLoaderResult> {
  const resolved = await resolveListingId(listingRef)
  if (resolved.error) return { data: null, error: resolved.error }
  if (!resolved.id) return { data: null, error: 'Listing not found' }
  return fetchListingCoreById(resolved.id)
}

/** Fast path when the caller already has a listing UUID (cards, prefetch). */
export async function fetchListingDetailById(listingId: string): Promise<ListingLoaderResult> {
  if (!isUuid(listingId)) return fetchListingDetail(listingId)
  return fetchListingCoreById(listingId)
}

/**
 * Build a paint-ready listing row from a marketplace card summary so PDP can
 * render instantly while the full detail request is in flight.
 */
export function listingRowFromSummary(listing: {
  id: string
  slug?: string | null
  title: string
  price: number
  mrp?: number | null
  price_includes_tax?: boolean | null
  tax_percent?: number | null
  listing_type: string
  average_rating?: number | null
  total_reviews?: number | null
  image_url?: string | null
  image_urls?: string[]
  images?: Array<{ id?: string; image_url: string; is_primary?: boolean; display_order?: number }>
  shop_name?: string | null
  shop_id?: string | null
  category?: string | null
  created_at?: string | null
  currency?: string
  shipping_required?: boolean | null
  listing_metadata?: unknown
  shop_verified?: boolean
  shop_rating?: number | null
  shop_review_count?: number | null
}): ListingRow {
  const urls =
    listing.image_urls?.length
      ? listing.image_urls
      : listing.image_url
        ? [listing.image_url]
        : []

  const listing_images =
    listing.images?.length
      ? listing.images.map((image, index) => ({
          id: image.id ?? `${listing.id}-img-${index}`,
          image_url: image.image_url,
          is_primary: image.is_primary ?? index === 0,
          display_order: image.display_order ?? index,
          alt_text: listing.title,
          image_type: null as string | null,
        }))
      : urls.map((image_url, index) => ({
          id: `${listing.id}-img-${index}`,
          image_url,
          is_primary: index === 0,
          display_order: index,
          alt_text: listing.title,
          image_type: null as string | null,
        }))

  return {
    id: listing.id,
    slug: listing.slug ?? null,
    title: listing.title,
    description: null,
    price: listing.price,
    listing_type: listing.listing_type,
    listing_status: 'active',
    is_active: true,
    average_rating: listing.average_rating ?? null,
    total_reviews: listing.total_reviews ?? null,
    stock: null,
    quantity: null,
    category: listing.category ?? null,
    tags: null,
    shop_id: listing.shop_id ?? null,
    created_at: listing.created_at ?? null,
    sku: null,
    weight: null,
    dimensions: null,
    listing_metadata: (listing.listing_metadata as ListingRow['listing_metadata']) ?? null,
    mrp: listing.mrp ?? null,
    price_includes_tax: listing.price_includes_tax ?? null,
    tax_percent: listing.tax_percent ?? null,
    product_info: null,
    digital_file_url: null,
    digital_file_type: null,
    digital_file_size: null,
    download_limit: null,
    shipping_required: listing.shipping_required ?? null,
    listing_images,
    listing_variations: [],
    listing_attributes: [],
    listing_delivery_profiles: null,
    shops: listing.shop_id
      ? {
          id: listing.shop_id,
          shop_name: listing.shop_name ?? 'Shop',
          logo_url: null,
          shop_currency: listing.currency ?? 'INR',
          verified: listing.shop_verified ?? null,
          slug: null,
          average_rating: listing.shop_rating ?? null,
          total_reviews: listing.shop_review_count ?? null,
          shop_metadata: null,
          user_id: null as unknown as string,
        }
      : null,
  } as ListingRow
}

export function listingLoaderResultFromSummary(
  listing: Parameters<typeof listingRowFromSummary>[0],
): ListingLoaderResult {
  return { data: listingRowFromSummary(listing), error: null }
}

export async function listingLoader({
  params,
}: LoaderProps<{ slug?: string }>): Promise<ListingLoaderResult> {
  const slug = typeof params.slug === 'string' ? params.slug : params.slug?.[0]
  if (!slug) return { data: null, error: 'Listing not found' }
  const result = await fetchListingDetail(slug)
  publishListingSeo(result, slug)
  return result
}

function publishListingSeo(result: ListingLoaderResult, slug: string) {
  if (!result.data) {
    publishSsrPageSeo(null)
    return
  }
  const images = mapListingImages(result.data)
  const primaryImage =
    images.find((image) => image.is_primary)?.image_url ?? images[0]?.image_url ?? null
  publishSsrPageSeo(
    pageSeo({
      title: result.data.title,
      description: plainSnippet(result.data.description) || undefined,
      image: primaryImage,
      type: 'product',
      canonicalPath: String(
        commerceRoutes.listing(result.data.slug ?? slug ?? result.data.id),
      ),
    }),
  )
}

export function mapListingImages(listing: ListingRow | null): ListingImage[] {
  return [...(listing?.listing_images ?? [])]
    .map((image) => {
      const meta = (image as ListingImage & { image_metadata?: unknown }).image_metadata
      const imageUrl = normalizeListingImageUrl(image.image_url, meta)
      return imageUrl ? { ...image, image_url: imageUrl } : null
    })
    .filter((image): image is ListingImage => image != null)
    .sort(
      (a, b) =>
        (a.is_primary ? -1 : 0) - (b.is_primary ? -1 : 0) || a.display_order - b.display_order,
    )
}
