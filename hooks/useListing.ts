import { useEffect, useState } from 'react'

import type { DeliveryProfile } from '~/commerce/lib/listing-fulfillment'
import { buildShopShippingSummary } from '~/commerce/lib/shop-shipping'
import type { ListingAttribute, ListingVariation } from '~/commerce/lib/listing-detail'
import { normalizeListingImageUrl } from '~/commerce/lib/listing-images'
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
  | 'digital_file_url'
  | 'digital_file_type'
  | 'digital_file_size'
  | 'download_limit'
  | 'shipping_required'
>

export type ListingImage = Pick<
  Tables<'listing_images'>,
  'id' | 'image_url' | 'is_primary' | 'display_order' | 'alt_text'
>

export type ListingShop = Pick<
  Tables<'shops'>,
  'id' | 'shop_name' | 'logo_url' | 'shop_currency' | 'verified' | 'slug' | 'average_rating' | 'total_reviews' | 'shop_metadata'
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

type ListingRow = ListingDetail & {
  listing_images: ListingImage[] | null
  listing_variations: ListingVariation[] | null
  listing_attributes: ListingAttribute[] | null
  listing_delivery_profiles: Array<{ delivery_profiles: DeliveryProfile | null }> | null
  shops: ListingShop | null
}

const LISTING_SELECT = `
  id, slug, title, description, price, listing_type, listing_status, is_active,
  average_rating, total_reviews, stock, quantity, category, tags,
  shop_id, created_at, sku, weight, dimensions, listing_metadata,
  digital_file_url, digital_file_type, digital_file_size, download_limit, shipping_required,
  listing_images(id, image_url, is_primary, display_order, alt_text, image_metadata),
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
    id, shop_name, logo_url, shop_currency, verified, slug, shop_metadata,
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

export function useListing(listingRef?: string) {
  const [listing, setListing] = useState<ListingRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!listingRef) {
      setListing(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)

      let data = null
      let listingError = null

      if (isUuid(listingRef!)) {
        const result = await supabase.from('listings').select(LISTING_SELECT).eq('id', listingRef!).maybeSingle()
        data = result.data
        listingError = result.error
      } else {
        const bySlug = await supabase.from('listings').select(LISTING_SELECT).eq('slug', listingRef!).maybeSingle()
        data = bySlug.data
        listingError = bySlug.error

        if (!data) {
          const titleGuess = listingRef!.replace(/-/g, ' ')
          const byTitle = await supabase
            .from('listings')
            .select(LISTING_SELECT)
            .ilike('title', titleGuess)
            .eq('is_active', true)
            .eq('listing_status', 'active')
            .limit(1)
            .maybeSingle()
          data = byTitle.data
          listingError = byTitle.error
        }

        if (!data) {
          const { data: activeListings } = await supabase
            .from('listings')
            .select(LISTING_SELECT)
            .eq('is_active', true)
            .eq('listing_status', 'active')
            .limit(300)

          data =
            activeListings?.find((row) => listingSlugMatches(row, listingRef!)) ??
            activeListings?.find(
              (row) => slugifyTitle(row.title) === listingRef!.toLowerCase(),
            ) ??
            null
        }

        if (!data) {
          const idPrefix = listingRef!.split('-')[0]
          if (isUuid(idPrefix)) {
            const byId = await supabase.from('listings').select(LISTING_SELECT).eq('id', idPrefix).maybeSingle()
            data = byId.data
            listingError = byId.error
          }
        }
      }

      if (cancelled) return

      if (listingError || !data) {
        setError(listingError?.message ?? 'Listing not found')
        setListing(null)
      } else {
        setListing(data as ListingRow)
      }

      setIsLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [listingRef])

  const images = [...(listing?.listing_images ?? [])]
    .map((image) => {
      const imageUrl = normalizeListingImageUrl(image.image_url, image.image_metadata)
      return imageUrl ? { ...image, image_url: imageUrl } : null
    })
    .filter((image): image is ListingImage => image != null)
    .sort(
      (a, b) =>
        (a.is_primary ? -1 : 0) - (b.is_primary ? -1 : 0) || a.display_order - b.display_order,
    )

  const variations = [...(listing?.listing_variations ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  )

  const attributes = [...(listing?.listing_attributes ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  )

  const deliveryProfiles =
    listing?.listing_delivery_profiles
      ?.map((row) => row.delivery_profiles)
      .filter((profile): profile is DeliveryProfile => profile != null) ?? []

  return { listing, images, variations, attributes, deliveryProfiles, isLoading, error }
}

export type { Json }
