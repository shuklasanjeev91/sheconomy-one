import {
  fetchSellerListings,
  type SellerListingRow,
} from '~/commerce/lib/seller-dashboard'
import { vendorRoutes } from '~/lib/routes'

export type VendorDraftHomeCard = {
  listingId: string
  title: string
  updatedAt: string
  imageUrl: string | null
  href: string
}

export function buildVendorDraftHomeCards(
  listings: SellerListingRow[],
  limit = 5,
): VendorDraftHomeCard[] {
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

export async function fetchVendorDraftHomeCards(
  shopId: string,
  limit = 5,
): Promise<{ cards: VendorDraftHomeCard[]; error: string | null }> {
  try {
    const listings = await fetchSellerListings(shopId, { status: 'draft', limit: limit * 2 })
    return { cards: buildVendorDraftHomeCards(listings, limit), error: null }
  } catch (error) {
    return {
      cards: [],
      error: error instanceof Error ? error.message : 'Could not load draft listings.',
    }
  }
}
