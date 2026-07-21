import type { LoaderProps } from 'one'

import type { DeliveryProfile } from '~/commerce/lib/listing-fulfillment'
import type { ListingAttribute, ListingVariation } from '~/commerce/lib/listing-detail'
import { normalizeListingImageUrl } from '~/commerce/lib/listing-images'
import { isListingStorefrontVisible, ACTIVE_LISTING_FILTER } from '~/commerce/lib/listing-visibility'
import { isUuid, listingSlugMatches, slugifyTitle } from '~/commerce/lib/seo-urls'
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
}

export type ListingRow = ListingDetail & {
  slug?: string | null
  listing_images: ListingImage[] | null
  listing_variations: ListingVariation[] | null
  listing_attributes: ListingAttribute[] | null
  listing_delivery_profiles: Array<{ delivery_profiles: DeliveryProfile | null }> | null
  shops: ListingShop | null
}

export const LISTING_DETAIL_SELECT = `
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
  listing_delivery_profiles(
    delivery_profiles(
      id, profile_name, processing_time_min, processing_time_max,
      fixed_fee, free_shipping_threshold, shipping_rate_type, delivery_metadata, is_default, is_active
    )
  ),
  shops(
    id, shop_name, logo_url, shop_currency, verified, slug, shop_metadata, user_id,
    average_rating, total_reviews,
    delivery_profiles(
      id, profile_name, processing_time_min, processing_time_max,
      fixed_fee, free_shipping_threshold, shipping_rate_type, delivery_metadata, is_default, is_active
    ),
    shipping_providers(id, provider_name, provider_type, is_primary, is_active, configuration),
    shop_shipping_accounts(provider, status),
    shipping_rates(delivery_days_min, delivery_days_max, zone_name, is_active, shipping_provider_id)
  )
`

export type ListingLoaderResult = {
  data: ListingRow | null
  error: string | null
}

export async function fetchListingDetail(listingRef: string): Promise<ListingLoaderResult> {
  let data = null
  let listingError = null

  if (isUuid(listingRef)) {
    const result = await supabase
      .from('listings')
      .select(LISTING_DETAIL_SELECT)
      .eq('id', listingRef)
      .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
      .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
      .maybeSingle()
    data = result.data
    listingError = result.error
  } else {
    const bySlug = await supabase
      .from('listings')
      .select(LISTING_DETAIL_SELECT)
      .eq('slug', listingRef)
      .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
      .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
      .maybeSingle()
    data = bySlug.data
    listingError = bySlug.error

    if (!data) {
      const titleGuess = listingRef.replace(/-/g, ' ')
      const byTitle = await supabase
        .from('listings')
        .select(LISTING_DETAIL_SELECT)
        .ilike('title', titleGuess)
        .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
        .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
        .limit(1)
        .maybeSingle()
      data = byTitle.data
      listingError = byTitle.error
    }

    if (!data) {
      const { data: activeListings } = await supabase
        .from('listings')
        .select(LISTING_DETAIL_SELECT)
        .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
        .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
        .limit(300)

      data =
        activeListings?.find((row) => listingSlugMatches(row, listingRef)) ??
        activeListings?.find((row) => slugifyTitle(row.title) === listingRef.toLowerCase()) ??
        null
    }

    if (!data) {
      const idPrefix = listingRef.split('-')[0]
      if (isUuid(idPrefix)) {
        const byId = await supabase
          .from('listings')
          .select(LISTING_DETAIL_SELECT)
          .eq('id', idPrefix)
          .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
          .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
          .maybeSingle()
        data = byId.data
        listingError = byId.error
      }
    }
  }

  if (data && !isListingStorefrontVisible(data)) {
    data = null
  }

  if (listingError || !data) {
    return { data: null, error: listingError?.message ?? 'Listing not found' }
  }

  return { data: data as ListingRow, error: null }
}

export async function listingLoader({
  params,
}: LoaderProps<{ slug?: string }>): Promise<ListingLoaderResult> {
  const slug = typeof params.slug === 'string' ? params.slug : params.slug?.[0]
  if (!slug) return { data: null, error: 'Listing not found' }
  return fetchListingDetail(slug)
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
