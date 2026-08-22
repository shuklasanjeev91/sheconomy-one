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

type ChatListingOptions = {
  postId?: string | null
  source?: string | null
  shopOwnerUserId?: string | null
}

function withChatListingOptions(
  payload: ChatListingPayload,
  options?: ChatListingOptions,
): ChatListingPayload {
  if (!options) return payload
  return {
    ...payload,
    postId: options.postId ?? payload.postId ?? null,
    source: options.source ?? payload.source ?? null,
    shopOwnerUserId: options.shopOwnerUserId ?? payload.shopOwnerUserId ?? null,
  }
}

export function listingDetailToChatListing(
  listing: ListingDetailLike,
  options?: ChatListingOptions,
): ChatListingPayload {
  return withChatListingOptions(
    {
      listingId: listing.id,
      title: listing.title,
      price: listing.price ?? null,
      currency: listing.currency ?? null,
      imageUrl: listing.imageUrl ?? null,
      slug: listing.slug ?? null,
      shopName: listing.shopName ?? null,
    },
    options,
  )
}

export function postProductToChatListing(
  product: PostProduct,
  options?: ChatListingOptions,
): ChatListingPayload | null {
  if (!product.listingId || !product.title) return null
  return withChatListingOptions(
    {
      listingId: product.listingId,
      title: product.title,
      price: product.price,
      currency: product.currency,
      imageUrl: product.imageUrl,
      slug: product.slug,
      shopName: product.shopName,
      shopOwnerUserId: product.shopOwnerUserId ?? null,
    },
    options,
  )
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
    postId: typeof raw.postId === 'string' ? raw.postId : null,
    source: typeof raw.source === 'string' ? raw.source : null,
    shopOwnerUserId: typeof raw.shopOwnerUserId === 'string' ? raw.shopOwnerUserId : null,
  }
}
