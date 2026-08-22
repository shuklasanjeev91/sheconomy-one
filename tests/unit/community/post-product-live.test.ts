import { describe, expect, it } from 'vitest'

import type { PostProduct } from '~/community/lib/community'
import {
  appendCommunityAttribution,
  buildCommunityListingHref,
  isListingSoldOut,
  mergePostProductWithLive,
} from '~/community/lib/post-product-live'

const snapshot: PostProduct = {
  listingId: 'listing-1',
  title: 'Silk scarf',
  price: 1200,
  currency: 'INR',
  imageUrl: 'https://cdn.example/scarf.jpg',
  slug: 'silk-scarf',
  shopName: 'Atelier',
  shopId: 'shop-1',
}

describe('mergePostProductWithLive', () => {
  it('marks missing live rows as unavailable', () => {
    const merged = mergePostProductWithLive(snapshot, undefined)
    expect(merged.liveStatus).toBe('unavailable')
    expect(merged.title).toBe('Silk scarf')
  })

  it('merges live listing fields and detects price updates', () => {
    const merged = mergePostProductWithLive(snapshot, {
      id: 'listing-1',
      slug: 'silk-scarf',
      title: 'Silk scarf (new)',
      card_title: 'Silk scarf (new)',
      price: 1400,
      currency: 'INR',
      image_url: 'https://cdn.example/scarf-new.jpg',
      image_urls: [],
      images: [],
      shop_name: 'Atelier',
      shop_id: 'shop-1',
      listing_type: 'physical',
      average_rating: 4.8,
      total_reviews: 12,
      shop_slug: null,
      shop_owner_user_id: 'shop-1',
    })

    expect(merged.liveStatus).toBe('available')
    expect(merged.title).toBe('Silk scarf (new)')
    expect(merged.price).toBe(1400)
    expect(merged.priceUpdated).toBe(true)
    expect(merged.averageRating).toBe(4.8)
    expect(merged.totalReviews).toBe(12)
    expect(merged.shopSlug).toBeNull()
    expect(merged.shopOwnerUserId).toBe('shop-1')
  })

  it('flags physical listings with zero quantity as sold out', () => {
    const merged = mergePostProductWithLive(snapshot, {
      id: 'listing-1',
      slug: 'silk-scarf',
      title: 'Silk scarf',
      card_title: 'Silk scarf',
      price: 1200,
      currency: 'INR',
      image_url: 'https://cdn.example/scarf.jpg',
      image_urls: [],
      images: [],
      shop_name: 'Atelier',
      shop_id: 'shop-1',
      listing_type: 'physical',
      quantity: 0,
      average_rating: null,
      total_reviews: null,
      shop_slug: null,
      shop_owner_user_id: 'shop-1',
    })

    expect(merged.soldOut).toBe(true)
    expect(merged.liveStatus).toBe('available')
  })

  it('does not mark services as sold out when quantity is zero', () => {
    expect(
      isListingSoldOut({
        listing_type: 'service',
        quantity: 0,
      }),
    ).toBe(false)
  })

  it('marks variant listings sold out when no variation has stock', () => {
    expect(
      isListingSoldOut({
        listing_type: 'physical',
        has_variations: true,
        variation_in_stock_count: 0,
      }),
    ).toBe(true)
  })

  it('keeps variant listings available when at least one variation has stock', () => {
    const merged = mergePostProductWithLive(snapshot, {
      id: 'listing-1',
      slug: 'silk-scarf',
      title: 'Silk scarf',
      card_title: 'Silk scarf',
      price: 1200,
      currency: 'INR',
      image_url: 'https://cdn.example/scarf.jpg',
      image_urls: [],
      images: [],
      shop_name: 'Atelier',
      shop_id: 'shop-1',
      listing_type: 'physical',
      has_variations: true,
      variation_in_stock_count: 2,
      average_rating: null,
      total_reviews: null,
      shop_slug: null,
      shop_owner_user_id: 'shop-1',
    })

    expect(merged.soldOut).toBe(false)
    expect(merged.soldOutVariantGated).toBe(false)
  })

  it('flags variant-gated sold out when all variations are out of stock', () => {
    const merged = mergePostProductWithLive(snapshot, {
      id: 'listing-1',
      slug: 'silk-scarf',
      title: 'Silk scarf',
      card_title: 'Silk scarf',
      price: 1200,
      currency: 'INR',
      image_url: 'https://cdn.example/scarf.jpg',
      image_urls: [],
      images: [],
      shop_name: 'Atelier',
      shop_id: 'shop-1',
      listing_type: 'physical',
      has_variations: true,
      variation_in_stock_count: 0,
      average_rating: null,
      total_reviews: null,
      shop_slug: null,
      shop_owner_user_id: 'shop-1',
    })

    expect(merged.soldOut).toBe(true)
    expect(merged.soldOutVariantGated).toBe(true)
  })
})

describe('community listing attribution', () => {
  it('appends ref and postId query params', () => {
    expect(appendCommunityAttribution('/listing/silk-scarf', 'post-9')).toBe(
      '/listing/silk-scarf?ref=community&postId=post-9',
    )
  })

  it('appends source when provided', () => {
    expect(
      appendCommunityAttribution('/listing/silk-scarf', 'post-9', { source: 'profile_shop' }),
    ).toBe('/listing/silk-scarf?ref=community&postId=post-9&source=profile_shop')
  })

  it('builds attributed href from product snapshot', () => {
    expect(buildCommunityListingHref(snapshot, 'post-9')).toContain('ref=community')
    expect(buildCommunityListingHref(snapshot, 'post-9')).toContain('postId=post-9')
    expect(buildCommunityListingHref(snapshot, 'post-9', { source: 'chat' })).toContain(
      'source=chat',
    )
  })
})
