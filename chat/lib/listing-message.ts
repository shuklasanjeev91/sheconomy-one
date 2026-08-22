import type { PostProduct } from '~/community/lib/community'
import type { ChatListingPayload } from '~/chat/lib/types'

type ListingDetailLike = {
  id: string
  title: string
  price?: number | null
  currency?: string | null
  slug?: string | null
  imageUrl?: string | null
  shopName?: string | null
}

export function listingDetailToChatListing(listing: ListingDetailLike): ChatListingPayload {
  return {
    listingId: listing.id,
    title: listing.title,
    price: listing.price ?? null,
    currency: listing.currency ?? null,
    imageUrl: listing.imageUrl ?? null,
    slug: listing.slug ?? null,
    shopName: listing.shopName ?? null,
  }
}

export function postProductToChatListing(product: PostProduct): ChatListingPayload | null {
  if (!product.listingId || !product.title) return null
  return {
    listingId: product.listingId,
    title: product.title,
    price: product.price,
    currency: product.currency,
    imageUrl: product.imageUrl,
    slug: product.slug,
    shopName: product.shopName,
  }
}

export function parseChatListingPayload(metadata: unknown): ChatListingPayload | null {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = metadata as Record<string, unknown>
  const listingId = typeof raw.listingId === 'string' ? raw.listingId : null
  const title = typeof raw.title === 'string' ? raw.title : null
  if (!listingId || !title) return null
  return {
    listingId,
    title,
    price: typeof raw.price === 'number' ? raw.price : null,
    currency: typeof raw.currency === 'string' ? raw.currency : null,
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : null,
    slug: typeof raw.slug === 'string' ? raw.slug : null,
    shopName: typeof raw.shopName === 'string' ? raw.shopName : null,
  }
}
