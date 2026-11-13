import { useEffect, useMemo, useState } from 'react'

import type { DeliveryProfile } from '~/commerce/lib/listing-fulfillment'
import {
  enrichListingShopShipping,
  fetchListingDetail,
  mapListingImages,
  type ListingImage,
  type ListingLoaderResult,
  type ListingRow,
} from '~/commerce/lib/listing-loader'
import { listingSlugMatches } from '~/commerce/lib/seo-urls'

export type { ListingDetail, ListingImage, ListingShop, ListingRow } from '~/commerce/lib/listing-loader'

type UseListingOptions = {
  /** Parent native loader still running — wait instead of double-fetching. */
  awaitingInitial?: boolean
}

/** True when the SSR/native loader payload is for the route slug currently on screen. */
function initialMatchesRef(
  listingRef: string | undefined,
  initial?: ListingLoaderResult | null,
): boolean {
  if (!listingRef || !initial) return false
  if (initial.data) return listingSlugMatches(initial.data, listingRef)
  // Error-only payloads: trust only on first paint when we have no better signal.
  // Soft-nav must refetch rather than keep showing a previous slug's error/empty.
  return false
}

export function useListing(
  listingRef?: string,
  initial?: ListingLoaderResult | null,
  options: UseListingOptions = {},
) {
  const { awaitingInitial = false } = options
  const matchedInitial = initialMatchesRef(listingRef, initial)
  const hasInitial = matchedInitial && Boolean(initial?.data || initial?.error)
  const [listing, setListing] = useState<ListingRow | null>(
    matchedInitial ? (initial?.data ?? null) : null,
  )
  const [isLoading, setIsLoading] = useState(!hasInitial && Boolean(listingRef))
  const [error, setError] = useState<string | null>(
    matchedInitial ? (initial?.error ?? null) : null,
  )

  useEffect(() => {
    if (!listingRef) {
      setListing(null)
      setIsLoading(false)
      setError(null)
      return
    }

    // Prefer SSR / native-loader payload only when it belongs to this slug.
    // Soft-nav reuses the page with a new slug while `useLoader` may still hold
    // the previous listing — applying it caused canonical-slug rewrite loops
    // (React #185 / APPSHELL crashes).
    if (matchedInitial && (initial?.data || initial?.error)) {
      setListing(initial.data)
      setError(initial.error)
      setIsLoading(false)
      return
    }

    if (awaitingInitial) {
      setIsLoading(true)
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
  }, [listingRef, matchedInitial, initial?.data, initial?.error, awaitingInitial])

  // Shipping rails are optional for first paint — fill in without blocking the spinner.
  useEffect(() => {
    if (!listing?.id || !listing.shop_id) return
    let cancelled = false
    void enrichListingShopShipping(listing).then((next) => {
      if (cancelled || next === listing) return
      setListing(next)
    })
    return () => {
      cancelled = true
    }
  }, [listing?.id, listing?.shop_id])

  const images = mapListingImages(listing)

  const variations = useMemo(
    () =>
      [...(listing?.listing_variations ?? [])].sort(
        (a, b) => a.display_order - b.display_order,
      ),
    [listing?.listing_variations],
  )

  const attributes = useMemo(
    () =>
      [...(listing?.listing_attributes ?? [])].sort(
        (a, b) => a.display_order - b.display_order,
      ),
    [listing?.listing_attributes],
  )

  const deliveryProfiles = useMemo(
    () =>
      listing?.listing_delivery_profiles
        ?.map((row) => row.delivery_profiles)
        .filter((profile): profile is DeliveryProfile => profile != null) ?? [],
    [listing?.listing_delivery_profiles],
  )

  return { listing, images, variations, attributes, deliveryProfiles, isLoading, error }
}

export type { Json } from '~/lib/supabase'
