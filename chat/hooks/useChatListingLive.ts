import { useEffect, useMemo, useState } from 'react'

import { fetchListingsByIds } from '~/commerce/lib/commerce'
import type { ChatListingPayload } from '~/chat/lib/types'
import { postProductToChatListing } from '~/chat/lib/listing-message'
import type { PostProduct } from '~/community/lib/community'
import {
  mergePostProductWithLive,
  type EnrichedPostProduct,
} from '~/community/lib/post-product-live'

function listingToPostProduct(listing: ChatListingPayload): PostProduct {
  return {
    listingId: listing.listingId,
    title: listing.title,
    price: listing.price,
    currency: listing.currency,
    imageUrl: listing.imageUrl,
    slug: listing.slug,
    shopName: listing.shopName,
    shopId: null,
    shopSlug: null,
    shopOwnerUserId: null,
  }
}

/** Fetch live listing data for a chat listing card snapshot. */
export function useChatListingLive(listing: ChatListingPayload): EnrichedPostProduct {
  const snapshot = useMemo(() => listingToPostProduct(listing), [listing])

  const [live, setLive] = useState<EnrichedPostProduct>(() =>
    mergePostProductWithLive(snapshot, undefined),
  )

  useEffect(() => {
    let cancelled = false
    void fetchListingsByIds([listing.listingId]).then((rows) => {
      if (cancelled) return
      setLive(mergePostProductWithLive(snapshot, rows[0]))
    })
    return () => {
      cancelled = true
    }
  }, [listing.listingId, snapshot])

  return live
}

export function chatListingPayloadFromEnriched(
  listing: ChatListingPayload,
  enriched: EnrichedPostProduct,
): ChatListingPayload {
  const mapped =
    postProductToChatListing(
      {
        listingId: listing.listingId,
        title: enriched.title || listing.title,
        price: enriched.price,
        currency: enriched.currency,
        imageUrl: enriched.imageUrl,
        slug: enriched.slug ?? listing.slug,
        shopName: enriched.shopName ?? listing.shopName,
        shopId: enriched.shopId,
        shopSlug: enriched.shopSlug,
        shopOwnerUserId: enriched.shopOwnerUserId,
      },
      {
        postId: listing.postId,
        source: listing.source,
        shopOwnerUserId: enriched.shopOwnerUserId ?? listing.shopOwnerUserId,
      },
    ) ?? listing
  return mapped
}
