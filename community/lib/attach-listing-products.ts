import {
  fetchListingsByIds,
  searchListingsPage,
  type ListingSummary,
} from '~/commerce/lib/commerce'
import type { SellerListingRow } from '~/commerce/lib/seller-dashboard'
import { fetchWishlistListingIds } from '~/commerce/lib/wishlist'
import type { PostProduct } from '~/community/lib/community'

export const MAX_ATTACHED_PRODUCTS = 3

export type ProductPickerTab = 'yours' | 'recent' | 'saved' | 'search'

/** Map a published commerce card into the feed post product snapshot. */
export function listingSummaryToPostProduct(listing: ListingSummary): PostProduct {
  return {
    listingId: listing.id,
    title: listing.title,
    price: listing.price,
    currency: listing.currency ?? null,
    imageUrl: listing.image_url ?? listing.image_urls[0] ?? null,
    slug: listing.slug,
    shopName: listing.shop_name,
    shopId: listing.shop_id ?? null,
    shopSlug: listing.shop_slug ?? null,
    shopOwnerUserId: listing.shop_owner_user_id ?? null,
  }
}

/** Map a seller-dashboard row into the feed post product snapshot. */
export function sellerListingToPostProduct(
  listing: SellerListingRow,
  shopName: string | null,
  currency: string | null,
  shopId: string | null = null,
  shopSlug: string | null = null,
  shopOwnerUserId: string | null = null,
): PostProduct {
  return {
    listingId: listing.id,
    title: listing.title,
    price: listing.price,
    currency,
    imageUrl: listing.primaryImageUrl,
    slug: listing.slug,
    shopName,
    shopId,
    shopSlug,
    shopOwnerUserId,
  }
}

export function togglePostProductAttachment(
  current: PostProduct[],
  next: PostProduct,
  max = MAX_ATTACHED_PRODUCTS,
): { products: PostProduct[]; capped: boolean } {
  const listingId = next.listingId
  if (!listingId) return { products: current, capped: false }

  const exists = current.some((item) => item.listingId === listingId)
  if (exists) {
    return {
      products: current.filter((item) => item.listingId !== listingId),
      capped: false,
    }
  }
  if (current.length >= max) {
    return { products: current, capped: true }
  }
  return { products: [...current, next], capped: false }
}

/** Load wishlist listings as attachable PostProduct rows (published only). */
export async function fetchWishlistAttachProducts(
  userId: string,
  limit = 40,
): Promise<PostProduct[]> {
  const { listingIds, error } = await fetchWishlistListingIds(userId)
  if (error || !listingIds.length) return []
  const listings = await fetchListingsByIds(listingIds.slice(0, limit))
  return listings.map(listingSummaryToPostProduct)
}

/** Search published listings for the attach picker. */
export async function searchAttachProducts(
  query: string,
  pageSize = 24,
): Promise<PostProduct[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const result = await searchListingsPage(trimmed, 0, { pageSize })
  return result.items.map(listingSummaryToPostProduct)
}

/** Load recently viewed listings as attachable PostProduct rows. */
export async function fetchRecentlyViewedAttachProducts(
  listingIds: string[],
  limit = 20,
): Promise<PostProduct[]> {
  if (!listingIds.length) return []
  const listings = await fetchListingsByIds(listingIds.slice(0, limit))
  return listings.map(listingSummaryToPostProduct)
}

/** Prefill a single listing for text-mode attach (e.g. PDP share). */
export async function fetchAttachProductById(
  listingId: string,
): Promise<PostProduct | null> {
  const [listing] = await fetchListingsByIds([listingId])
  return listing ? listingSummaryToPostProduct(listing) : null
}
