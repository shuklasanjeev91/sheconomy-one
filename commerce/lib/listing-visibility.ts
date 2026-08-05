import { supabase } from '~/lib/supabase/client'

export const ACTIVE_LISTING_STATUS = 'active' as const

/** Buyer-facing catalog rules — listing must be active and published. */
export const ACTIVE_LISTING_FILTER = {
  is_active: true,
  listing_status: ACTIVE_LISTING_STATUS,
} as const

/**
 * Shop must be active AND verified for its listings to appear in the storefront.
 * Applied as `.eq('shops.is_active', true).eq('shops.verified', true)` on queries
 * that join `shops!inner(...)`.
 */
export const ACTIVE_SHOP_FILTER = {
  is_active: true,
  verified: true,
} as const

export type ListingVisibilityFields = {
  is_active?: boolean | null
  listing_status?: string | null
}

export function isListingStorefrontVisible(
  listing: ListingVisibilityFields | null | undefined,
): boolean {
  return listing?.is_active === true && listing?.listing_status === ACTIVE_LISTING_STATUS
}

/** Returns the subset of listing IDs that are visible on the storefront. */
export async function fetchActiveListingIdSet(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()

  const { data, error } = await supabase
    .from('listings')
    .select('id, shops!inner(is_active, verified)')
    .in('id', ids)
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)
    .eq('shops.is_active', ACTIVE_SHOP_FILTER.is_active)
    .eq('shops.verified', ACTIVE_SHOP_FILTER.verified)

  if (error || !data?.length) return new Set()

  return new Set(data.map((row) => row.id))
}
