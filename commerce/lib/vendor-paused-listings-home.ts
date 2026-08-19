import {
  fetchSellerListings,
  type SellerListingRow,
} from '~/commerce/lib/seller-dashboard'
import { vendorRoutes } from '~/lib/routes'

export type VendorPausedListingHomeCard = {
  listingId: string
  title: string
  updatedAt: string
  imageUrl: string | null
  href: string
}

export function buildVendorPausedListingHomeCards(
  listings: SellerListingRow[],
  limit = 5,
): VendorPausedListingHomeCard[] {
  return listings
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit)
    .map((listing) => ({
      listingId: listing.id,
      title: listing.title?.trim() || 'Untitled listing',
      updatedAt: listing.updatedAt,
      imageUrl: listing.primaryImageUrl,
      href: vendorRoutes.editListing(listing.id),
    }))
}

export async function fetchVendorPausedListingHomeCards(
  shopId: string,
  limit = 5,
): Promise<{ cards: VendorPausedListingHomeCard[]; error: string | null }> {
  try {
    const listings = await fetchSellerListings(shopId, { status: 'paused', limit: limit * 2 })
    return { cards: buildVendorPausedListingHomeCards(listings, limit), error: null }
  } catch (error) {
    return {
      cards: [],
      error: error instanceof Error ? error.message : 'Could not load paused listings.',
    }
  }
}
