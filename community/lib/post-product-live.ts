import { Platform } from 'react-native'

import type { ListingSummary } from '~/commerce/lib/commerce'
import type { PostProduct } from '~/community/lib/community'
import { LISTING_TYPES } from '~/lib/listing/listing.type'
import { commerceRoutes } from '~/lib/routes'

export type LivePostProductStatus = 'available' | 'unavailable'

export type EnrichedPostProduct = PostProduct & {
  liveStatus: LivePostProductStatus
  priceUpdated: boolean
  snapshotPrice: number | null
  averageRating: number | null
  totalReviews: number | null
  soldOut: boolean
}

export function isListingSoldOut(live: Pick<ListingSummary, 'listing_type' | 'quantity'>): boolean {
  if (live.listing_type !== LISTING_TYPES.PHYSICAL) return false
  const quantity = live.quantity ?? null
  return quantity !== null && quantity <= 0
}

/** Merge stored post snapshot with a live listing row (if fetched). */
export function mergePostProductWithLive(
  snapshot: PostProduct,
  live: ListingSummary | null | undefined,
): EnrichedPostProduct {
  const snapshotPrice = snapshot.price
  if (!live) {
    return {
      ...snapshot,
      liveStatus: 'unavailable',
      priceUpdated: false,
      snapshotPrice,
      averageRating: null,
      totalReviews: null,
      soldOut: false,
    }
  }

  const livePrice = typeof live.price === 'number' ? live.price : null
  const priceUpdated =
    snapshotPrice != null && livePrice != null && snapshotPrice !== livePrice

  return {
    listingId: snapshot.listingId ?? live.id,
    title: live.title || snapshot.title,
    price: livePrice ?? snapshotPrice,
    currency: live.currency ?? snapshot.currency,
    imageUrl: live.image_url ?? live.image_urls[0] ?? snapshot.imageUrl,
    slug: live.slug ?? snapshot.slug,
    shopName: live.shop_name ?? snapshot.shopName,
    shopId: live.shop_id ?? snapshot.shopId ?? null,
    shopSlug: live.shop_slug ?? snapshot.shopSlug ?? null,
    shopOwnerUserId: live.shop_owner_user_id ?? snapshot.shopOwnerUserId ?? null,
    liveStatus: 'available',
    priceUpdated,
    snapshotPrice,
    averageRating: live.average_rating ?? null,
    totalReviews: live.total_reviews ?? null,
    soldOut: isListingSoldOut(live),
  }
}

/** Listing route for a post product (native prefers id; web prefers slug). */
export function listingPathForProduct(product: PostProduct): string | null {
  if (Platform.OS !== 'web' && product.listingId) {
    return String(commerceRoutes.listing(product.listingId))
  }
  if (product.slug || product.listingId) {
    return String(commerceRoutes.listing(product.slug ?? product.listingId!))
  }
  return null
}

/** Append community attribution query params for PDP opens from posts. */
export function appendCommunityAttribution(path: string, postId: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}ref=community&postId=${encodeURIComponent(postId)}`
}

export function buildCommunityListingHref(product: PostProduct, postId: string): string | null {
  const path = listingPathForProduct(product)
  if (!path) return null
  return appendCommunityAttribution(path, postId)
}
