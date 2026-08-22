import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchListingsByIdsMock = vi.fn()

vi.mock('~/commerce/lib/commerce', () => ({
  fetchListingsByIds: (...args: unknown[]) => fetchListingsByIdsMock(...args),
}))

import {
  buildSavedShoppablePriceDropRows,
  countSavedShoppablePriceDrops,
} from '~/community/lib/saved-shoppable-nudges'

describe('saved shoppable nudges', () => {
  beforeEach(() => {
    fetchListingsByIdsMock.mockReset()
  })

  it('counts posts with at least one price drop', () => {
    expect(
      countSavedShoppablePriceDrops([
        { postId: 'p1', priceDropped: true },
        { postId: 'p1', priceDropped: true },
        { postId: 'p2', priceDropped: false },
        { postId: 'p3', priceDropped: true },
      ]),
    ).toBe(2)
  })

  it('flags price drops when live price is below the saved snapshot', async () => {
    fetchListingsByIdsMock.mockResolvedValue([
      { id: 'l1', price: 800, currency: 'INR', listing_type: 'physical' },
      { id: 'l2', price: 1200, currency: 'INR', listing_type: 'physical' },
    ])

    const rows = await buildSavedShoppablePriceDropRows([
      {
        postId: 'post-1',
        products: [
          { listingId: 'l1', title: 'Serum', price: 1000, currency: 'INR', imageUrl: null, slug: null, shopName: 'Glow' },
          { listingId: 'l2', title: 'Cream', price: 1200, currency: 'INR', imageUrl: null, slug: null, shopName: 'Glow' },
        ],
      },
      {
        postId: 'post-2',
        products: [
          { listingId: 'l2', title: 'Cream', price: 900, currency: 'INR', imageUrl: null, slug: null, shopName: 'Glow' },
        ],
      },
    ])

    expect(rows).toEqual([
      { postId: 'post-1', priceDropped: true },
      { postId: 'post-2', priceDropped: false },
    ])
  })
})
