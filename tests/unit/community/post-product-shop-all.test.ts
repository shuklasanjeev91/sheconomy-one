import { describe, expect, it } from 'vitest'

import { summarizeShopAllResults, shopAllEligibleProducts } from '~/community/lib/post-product-shop-all'
import type { EnrichedPostProduct } from '~/community/lib/post-product-live'

function makeProduct(overrides: Partial<EnrichedPostProduct>): EnrichedPostProduct {
  return {
    listingId: 'listing-1',
    title: 'Serum',
    price: 900,
    currency: 'INR',
    imageUrl: null,
    slug: null,
    shopName: 'Glow',
    liveStatus: 'available',
    priceUpdated: false,
    priceDropped: false,
    snapshotPrice: 900,
    averageRating: null,
    totalReviews: null,
    soldOut: false,
    soldOutVariantGated: false,
    ...overrides,
  }
}

describe('shopAllEligibleProducts', () => {
  it('keeps only in-stock available listings', () => {
    const products = [
      makeProduct({ listingId: 'l1' }),
      makeProduct({ listingId: 'l2', soldOut: true }),
      makeProduct({ listingId: 'l3', liveStatus: 'unavailable' }),
      makeProduct({ listingId: null }),
    ]

    expect(shopAllEligibleProducts(products).map((product) => product.listingId)).toEqual(['l1'])
  })
})

describe('summarizeShopAllResults', () => {
  it('aggregates added and skipped rows', () => {
    expect(
      summarizeShopAllResults([
        { listingId: 'l1', error: null, eligible: true },
        { listingId: 'l2', error: 'Choose options', eligible: true },
        { listingId: 'l3', error: null, eligible: false, reason: 'sold_out' },
      ]),
    ).toEqual({
      addedListingIds: ['l1'],
      skipped: [
        { listingId: 'l2', reason: 'variant_required' },
        { listingId: 'l3', reason: 'sold_out' },
      ],
    })
  })
})
