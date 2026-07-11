import { supabase } from '~/lib/supabase/client'

export const ACTIVE_LISTING_STATUS = 'active' as const

/** Buyer-facing catalog rules — listing must be active and published. */
export const ACTIVE_LISTING_FILTER = {
  is_active: true,
  listing_status: ACTIVE_LISTING_STATUS,
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
    .select('id')
    .in('id', ids)
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)

  if (error || !data?.length) return new Set()

  return new Set(data.map((row) => row.id))
}
