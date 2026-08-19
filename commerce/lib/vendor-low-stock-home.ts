import { fetchLowStockListings, type LowStockListing } from '~/commerce/lib/low-stock'
import { vendorRoutes } from '~/lib/routes'

export type VendorLowStockHomeCard = {
  listingId: string
  title: string
  stock: number
  href: string
}

export function buildVendorLowStockHomeCards(
  listings: LowStockListing[],
  limit = 5,
): VendorLowStockHomeCard[] {
  return listings.slice(0, limit).map((listing) => ({
    listingId: listing.id,
    title: listing.title,
    stock: listing.stock,
    href: vendorRoutes.editListing(listing.id),
  }))
}

export async function fetchVendorLowStockHomeCards(
  shopId: string,
  limit = 5,
): Promise<{ cards: VendorLowStockHomeCard[]; error: string | null }> {
  const result = await fetchLowStockListings(shopId)
  return {
    cards: buildVendorLowStockHomeCards(result.listings, limit),
    error: result.error,
  }
}

export function vendorLowStockProductsHref() {
  return vendorRoutes.products
}
