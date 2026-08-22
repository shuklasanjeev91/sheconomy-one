import { trackAnalyticsEvent } from '~/lib/analytics'

export type CommunityCommerceSource = 'composer' | 'feed' | 'pdp_share'

type BaseProps = {
  postId?: string | null
  listingId?: string | null
  source: CommunityCommerceSource
}

export function trackCommunityPostListingsAttached(props: {
  postId: string
  listingIds: string[]
  source: CommunityCommerceSource
}) {
  trackAnalyticsEvent('community_post_listing_attached', {
    post_id: props.postId,
    listing_ids: props.listingIds.join(','),
    listing_count: props.listingIds.length,
    source: props.source,
  })
}

export function trackCommunityPostProductImpression(props: BaseProps) {
  trackAnalyticsEvent('community_post_product_impression', {
    post_id: props.postId ?? undefined,
    listing_id: props.listingId ?? undefined,
    source: props.source,
  })
}

export function trackCommunityPostAddToCart(props: BaseProps) {
  trackAnalyticsEvent('community_post_add_to_cart', {
    post_id: props.postId ?? undefined,
    listing_id: props.listingId ?? undefined,
    source: props.source,
  })
}

export function trackCommunityPostCheckoutStart(props: BaseProps) {
  trackAnalyticsEvent('community_post_checkout_start', {
    post_id: props.postId ?? undefined,
    listing_id: props.listingId ?? undefined,
    source: props.source,
  })
}

export function trackCommunityPostPdpOpen(props: BaseProps & { ref?: string }) {
  trackAnalyticsEvent('community_post_pdp_open', {
    post_id: props.postId ?? undefined,
    listing_id: props.listingId ?? undefined,
    source: props.source,
    ref: props.ref ?? 'community',
  })
}

export function trackCommunityPostWishlistToggle(props: BaseProps & { saved: boolean }) {
  trackAnalyticsEvent('community_post_wishlist_toggle', {
    post_id: props.postId ?? undefined,
    listing_id: props.listingId ?? undefined,
    source: props.source,
    saved: props.saved,
  })
}

export function trackCommunityPostPdpLanding(props: BaseProps & { ref?: string }) {
  trackAnalyticsEvent('community_post_pdp_landing', {
    post_id: props.postId ?? undefined,
    listing_id: props.listingId ?? undefined,
    source: props.source,
    ref: props.ref ?? 'community',
  })
}

export function trackCommunityPostMessageSeller(props: BaseProps) {
  trackAnalyticsEvent('community_post_message_seller', {
    post_id: props.postId ?? undefined,
    listing_id: props.listingId ?? undefined,
    source: props.source,
  })
}

export function trackCommunityPostShareListingToChat(
  props: BaseProps & { conversationId: string },
) {
  trackAnalyticsEvent('community_post_share_listing_to_chat', {
    post_id: props.postId ?? undefined,
    listing_id: props.listingId ?? undefined,
    source: props.source,
    conversation_id: props.conversationId,
  })
}
