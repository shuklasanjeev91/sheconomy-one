import { describe, expect, it } from 'vitest'

import { buildWishlistReactivation } from '~/commerce/lib/wishlist-reactivation'
import type { ListingSummary } from '~/lib/supabase/commerce'

function listing(overrides: Partial<ListingSummary> & Pick<ListingSummary, 'id' | 'title'>): ListingSummary {
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
    created_at: null,
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

describe('buildWishlistReactivation', () => {
  it('prioritizes saved-from-cart items ahead of other wishlist entries', () => {
    const result = buildWishlistReactivation({
      items: [
        listing({ id: 'saved-cart', title: 'Saved Cart Pick' }),
        listing({ id: 'discounted', title: 'Discounted Pick', price: 80, mrp: 120 }),
        listing({ id: 'plain', title: 'Plain Pick' }),
      ],
      savedFromCart: { 'saved-cart': 1000 },
    })

    expect(result.sections.find((section) => section.key === 'saved_from_cart')?.items[0]?.id).toBe(
      'saved-cart',
    )
    expect(result.sections.find((section) => section.key === 'ready_to_buy')?.items[0]?.id).toBe(
      'discounted',
    )
  })

  it('creates price-wins and more-saved lanes without duplicating items across sections', () => {
    const result = buildWishlistReactivation({
      items: [
        listing({ id: 'a', title: 'A', price: 90, mrp: 140 }),
        listing({ id: 'b', title: 'B' }),
        listing({ id: 'c', title: 'C' }),
        listing({ id: 'd', title: 'D' }),
        listing({ id: 'e', title: 'E' }),
      ],
      savedFromCart: {},
    })

    const seen = new Set<string>()
    for (const section of result.sections) {
      for (const item of section.items) {
        expect(seen.has(item.id)).toBe(false)
        seen.add(item.id)
      }
    }

    expect(result.counts.priceWins).toBeGreaterThanOrEqual(1)
    expect(result.sections.some((section) => section.key === 'more_saved')).toBe(true)
  })

  it('only enables bulk move on actionable top sections', () => {
    const result = buildWishlistReactivation({
      items: [
        listing({ id: 'a', title: 'A', price: 90, mrp: 140 }),
        listing({ id: 'b', title: 'B', price: 70, mrp: 100 }),
      ],
      savedFromCart: {},
    })

    const ready = result.sections.find((section) => section.key === 'ready_to_buy')
    const more = result.sections.find((section) => section.key === 'more_saved')
    expect(ready?.canBulkMoveToCart).toBe(true)
    expect(more?.canBulkMoveToCart ?? false).toBe(false)
  })
})
