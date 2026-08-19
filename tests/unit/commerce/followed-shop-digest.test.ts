import { describe, expect, it } from 'vitest'

import {
  buildFollowedShopDigest,
  type FollowedShopDigestItem,
} from '~/commerce/lib/followed-shop-digest'
import type { FollowedShopSummary } from '~/commerce/lib/shop-follows'
import type { ListingSummary } from '~/lib/supabase/commerce'

function followedShop(
  overrides: Partial<FollowedShopSummary> & Pick<FollowedShopSummary, 'id' | 'shop_name'>,
): FollowedShopSummary {
  return {
    id: overrides.id,
    shop_name: overrides.shop_name,
    slug: overrides.id,
    logo_url: null,
    shop_description: null,
    average_rating: 4.5,
    total_reviews: 20,
    verified: true,
    shop_currency: 'INR',
    followed_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function listing(
  overrides: Partial<ListingSummary> & Pick<ListingSummary, 'id' | 'title'>,
): ListingSummary {
  return {
    id: overrides.id,
    slug: overrides.id,
    title: overrides.title,
    card_title: overrides.title,
    price: 100,
    mrp: null,
    price_includes_tax: true,
    tax_percent: null,
    product_info: null,
    listing_type: 'physical',
    average_rating: 4.2,
    total_reviews: 12,
    image_url: null,
    image_urls: [],
    images: [],
    shop_name: 'Shop',
    shop_id: 'shop-1',
    category: null,
    created_at: '2026-08-18T00:00:00.000Z',
    currency: 'INR',
    is_featured: false,
    shop_rating: 4.5,
    shop_review_count: 20,
    shop_verified: true,
    shop_address: null,
    shipping_required: true,
    listing_metadata: null,
    listing_delivery_profiles: [],
    shop_shipping: null,
    ...overrides,
  }
}

function ids(items: FollowedShopDigestItem[] | undefined) {
  return (items ?? []).map((item) => item.id)
}

describe('buildFollowedShopDigest', () => {
  it('builds new arrivals, price drops, and saved overlap without duplicating items across sections', () => {
    const result = buildFollowedShopDigest({
      followedShops: [
        followedShop({ id: 'shop-1', shop_name: 'Shop One' }),
        followedShop({ id: 'shop-2', shop_name: 'Shop Two' }),
      ],
      recentListings: [
        listing({ id: 'new-drop', title: 'New Drop', shop_id: 'shop-1', created_at: '2026-08-19T00:00:00.000Z' }),
        listing({ id: 'price-drop', title: 'Price Drop', shop_id: 'shop-2', price: 80 }),
      ],
      favoriteListings: [
        listing({ id: 'price-drop', title: 'Price Drop', shop_id: 'shop-2', price: 80 }),
        listing({ id: 'saved-pick', title: 'Saved Pick', shop_id: 'shop-1', price: 95 }),
      ],
      priceBaseline: {
        'price-drop': 120,
        'saved-pick': 95,
      },
      nowMs: Date.parse('2026-08-19T12:00:00.000Z'),
    })

    expect(ids(result.sections.find((section) => section.key === 'new_arrivals')?.items)).toContain('new-drop')
    expect(ids(result.sections.find((section) => section.key === 'price_drops')?.items)).toContain('price-drop')
    expect(ids(result.sections.find((section) => section.key === 'saved_overlap')?.items)).toContain('saved-pick')

    const seen = new Set<string>()
    for (const section of result.sections) {
      for (const item of section.items) {
        expect(seen.has(item.id)).toBe(false)
        seen.add(item.id)
      }
    }
  })

  it('ignores listings from shops the user does not follow and hides stale arrivals', () => {
    const result = buildFollowedShopDigest({
      followedShops: [followedShop({ id: 'shop-1', shop_name: 'Shop One' })],
      recentListings: [
        listing({ id: 'stale', title: 'Stale', shop_id: 'shop-1', created_at: '2026-07-01T00:00:00.000Z' }),
        listing({ id: 'other-shop', title: 'Other Shop', shop_id: 'shop-9' }),
      ],
      favoriteListings: [listing({ id: 'other-favorite', title: 'Other Favorite', shop_id: 'shop-9' })],
      priceBaseline: {},
      nowMs: Date.parse('2026-08-19T12:00:00.000Z'),
    })

    expect(result.sections.length).toBe(0)
    expect(result.hasActivity).toBe(false)
  })

  it('reports summary counts from the full eligible candidate pools', () => {
    const result = buildFollowedShopDigest({
      followedShops: [followedShop({ id: 'shop-1', shop_name: 'Shop One' })],
      recentListings: [
        listing({ id: 'a', title: 'A', shop_id: 'shop-1', created_at: '2026-08-19T00:00:00.000Z' }),
        listing({ id: 'b', title: 'B', shop_id: 'shop-1', created_at: '2026-08-18T00:00:00.000Z', price: 90 }),
      ],
      favoriteListings: [
        listing({ id: 'b', title: 'B', shop_id: 'shop-1', price: 90 }),
        listing({ id: 'c', title: 'C', shop_id: 'shop-1', price: 70 }),
      ],
      priceBaseline: {
        b: 120,
        c: 90,
      },
      nowMs: Date.parse('2026-08-19T12:00:00.000Z'),
    })

    expect(result.counts.followedShops).toBe(1)
    expect(result.counts.newArrivals).toBe(2)
    expect(result.counts.priceDrops).toBe(2)
    expect(result.counts.savedOverlap).toBe(2)
  })
})
