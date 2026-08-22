import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/lib/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
}))

import { trackAnalyticsEvent } from '~/lib/analytics'
import {
  trackCommunityPostAddToCart,
  trackCommunityPostCheckoutStart,
  trackCommunityPostListingsAttached,
  trackCommunityPostPdpOpen,
  trackCommunityPostProductImpression,
  trackCommunityPostWishlistToggle,
  trackCommunityPostShareListingToChat,
  trackChatListingMessageSent,
  trackCommunityFeedShoppableFilter,
  trackCreatorCommerceInsightsView,
} from '~/community/lib/community-commerce-analytics'

describe('community commerce analytics', () => {
  beforeEach(() => {
    vi.mocked(trackAnalyticsEvent).mockClear()
  })

  it('emits community_post_listing_attached with joined listing ids', () => {
    trackCommunityPostListingsAttached({
      postId: 'post-1',
      listingIds: ['l1', 'l2'],
      source: 'composer',
    })
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('community_post_listing_attached', {
      post_id: 'post-1',
      listing_ids: 'l1,l2',
      listing_count: 2,
      source: 'composer',
    })
  })

  it('emits impression, cart, checkout, and pdp events with source', () => {
    trackCommunityPostProductImpression({
      postId: 'post-1',
      listingId: 'l1',
      source: 'feed',
    })
    trackCommunityPostAddToCart({ postId: 'post-1', listingId: 'l1', source: 'feed' })
    trackCommunityPostCheckoutStart({ postId: 'post-1', listingId: 'l1', source: 'feed' })
    trackCommunityPostPdpOpen({ postId: 'post-1', listingId: 'l1', source: 'pdp_share', ref: 'community' })

    expect(trackAnalyticsEvent).toHaveBeenCalledWith(
      'community_post_product_impression',
      expect.objectContaining({ source: 'feed', listing_id: 'l1' }),
    )
    expect(trackAnalyticsEvent).toHaveBeenCalledWith(
      'community_post_add_to_cart',
      expect.objectContaining({ source: 'feed' }),
    )
    expect(trackAnalyticsEvent).toHaveBeenCalledWith(
      'community_post_checkout_start',
      expect.objectContaining({ source: 'feed' }),
    )
    expect(trackAnalyticsEvent).toHaveBeenCalledWith(
      'community_post_pdp_open',
      expect.objectContaining({ source: 'pdp_share', ref: 'community' }),
    )
  })

  it('emits wishlist toggle events', () => {
    trackCommunityPostWishlistToggle({
      postId: 'post-1',
      listingId: 'l1',
      source: 'feed',
      saved: true,
    })
    expect(trackAnalyticsEvent).toHaveBeenCalledWith(
      'community_post_wishlist_toggle',
      expect.objectContaining({ saved: true, listing_id: 'l1' }),
    )
  })

  it('emits share listing to chat events', () => {
    trackCommunityPostShareListingToChat({
      postId: 'post-1',
      listingId: 'l1',
      source: 'feed',
      conversationId: 'chat-9',
    })
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('community_post_share_listing_to_chat', {
      post_id: 'post-1',
      listing_id: 'l1',
      source: 'feed',
      conversation_id: 'chat-9',
    })
  })

  it('emits chat listing message sent events', () => {
    trackChatListingMessageSent({
      listingId: 'l1',
      conversationId: 'chat-3',
    })
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('chat_listing_message_sent', {
      listing_id: 'l1',
      conversation_id: 'chat-3',
    })
  })

  it('emits shoppable feed filter events', () => {
    trackCommunityFeedShoppableFilter({ enabled: true })
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('community_feed_shoppable_filter', {
      enabled: true,
    })
  })

  it('emits creator commerce insights view events', () => {
    trackCreatorCommerceInsightsView({
      postsWithProducts: 4,
      uniqueListings: 7,
    })
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('creator_commerce_insights_view', {
      posts_with_products: 4,
      unique_listings: 7,
    })
  })
})
