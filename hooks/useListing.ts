import { useEffect, useState } from 'react'

import type { DeliveryProfile } from '~/commerce/lib/listing-fulfillment'
import {
  fetchListingDetail,
  mapListingImages,
  type ListingImage,
  type ListingLoaderResult,
  type ListingRow,
} from '~/commerce/lib/listing-loader'

export type { ListingDetail, ListingImage, ListingShop, ListingRow } from '~/commerce/lib/listing-loader'

export function useListing(
  listingRef?: string,
  initial?: ListingLoaderResult | null,
) {
  const hasInitial = Boolean(initial?.data || initial?.error)
  const [listing, setListing] = useState<ListingRow | null>(initial?.data ?? null)
  const [isLoading, setIsLoading] = useState(!hasInitial && Boolean(listingRef))
  const [error, setError] = useState<string | null>(initial?.error ?? null)

  useEffect(() => {
    if (!listingRef) {
      setListing(null)
      setIsLoading(false)
      setError(null)
      return
    }

    // Prefer SSR / native-loader payload when present for this mount.
    if (initial?.data || initial?.error) {
      setListing(initial.data)
      setError(initial.error)
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      const result = await fetchListingDetail(listingRef!)
      if (cancelled) return
      setListing(result.data)
      setError(result.error)
      setIsLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [listingRef, initial?.data, initial?.error])

  const images = mapListingImages(listing)

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

export type { Json } from '~/lib/supabase'
