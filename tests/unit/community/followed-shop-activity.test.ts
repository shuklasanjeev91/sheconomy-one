import { describe, expect, it } from 'vitest'

import { buildFollowedShopActivityCards } from '~/community/lib/followed-shop-activity'
import type { FollowedShopDigestItem, FollowedShopDigestSection } from '~/commerce/lib/followed-shop-digest'

function digestItem(
  overrides: Partial<FollowedShopDigestItem> & Pick<FollowedShopDigestItem, 'id' | 'title' | 'source'>,
): FollowedShopDigestItem {
  return {
    slug: overrides.id,
    card_title: overrides.title,
    price: 900,
    mrp: null,
    price_includes_tax: true,
    tax_percent: null,
    product_info: null,
    listing_type: 'physical',
    average_rating: 4.5,
    total_reviews: 10,
    image_url: null,
    image_urls: [],
    images: [],
    shop_name: 'Glow Shop',
    shop_id: 'shop-1',
    category: null,
    created_at: '2026-08-18T00:00:00.000Z',
    currency: 'INR',
    score: 50,
    shopSlug: 'glow-shop',
    shopFollowedAt: '2026-08-01T00:00:00.000Z',
    freshnessDays: 1,
    previousPrice: null,
    priceDropAmount: 0,
    isFavorite: false,
    ...overrides,
  }
}

function digestSection(
  key: FollowedShopDigestSection['key'],
  items: FollowedShopDigestItem[],
): FollowedShopDigestSection {
  return {
    key,
    title: key,
    subtitle: key,
    items,
    count: items.length,
    actionLabel: 'Move to cart',
    canBulkMoveToCart: true,
  }
}

describe('buildFollowedShopActivityCards', () => {
  it('prioritizes price drops and sorts by score within merged sections', () => {
    const cards = buildFollowedShopActivityCards(
      [
        digestSection('new_arrivals', [
          digestItem({ id: 'new-1', title: 'New serum', source: 'new_arrival', score: 60 }),
        ]),
        digestSection('price_drops', [
          digestItem({
            id: 'drop-1',
            title: 'Dropped cream',
            source: 'price_drop',
            score: 95,
            previousPrice: 1200,
            priceDropAmount: 300,
          }),
        ]),
      ],
      8,
    )

    expect(cards.map((card) => card.listingId)).toEqual(['drop-1', 'new-1'])
    expect(cards[0]?.sourceLabel).toBe('Price drop')
    expect(cards[0]?.previousPriceLabel).toContain('1,200')
  })

  it('dedupes listings that appear in multiple digest sections', () => {
    const shared = digestItem({
      id: 'shared-1',
      title: 'Shared listing',
      source: 'price_drop',
      score: 80,
    })

    const cards = buildFollowedShopActivityCards(
      [
        digestSection('price_drops', [shared]),
        digestSection('saved_overlap', [
          digestItem({ ...shared, source: 'saved_overlap', score: 70 }),
        ]),
      ],
      8,
    )

    expect(cards).toHaveLength(1)
    expect(cards[0]?.sourceLabel).toBe('Price drop')
  })

  it('limits cards to the requested count', () => {
    const cards = buildFollowedShopActivityCards(
      [
        digestSection(
          'new_arrivals',
          Array.from({ length: 5 }, (_, index) =>
            digestItem({
              id: `listing-${index}`,
              title: `Listing ${index}`,
              source: 'new_arrival',
              score: 50 + index,
            }),
          ),
        ),
      ],
      3,
    )

    expect(cards).toHaveLength(3)
  })

  it('builds listing detail hrefs', () => {
    const cards = buildFollowedShopActivityCards(
      [
        digestSection('new_arrivals', [
          digestItem({ id: 'listing-abc', title: 'Face oil', source: 'new_arrival' }),
        ]),
      ],
      8,
    )

    expect(cards[0]?.href).toBe('/listing/listing-abc?ref=community&source=followed_shop')
    expect(cards[0]?.priceLabel).toContain('900')
  })
})
