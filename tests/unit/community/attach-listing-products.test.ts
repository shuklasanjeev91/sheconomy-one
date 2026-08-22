import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  MAX_ATTACHED_PRODUCTS,
  listingSummaryToPostProduct,
  sellerListingToPostProduct,
  togglePostProductAttachment,
  fetchAttachProductById,
} from '~/community/lib/attach-listing-products'
import type { PostProduct } from '~/community/lib/community'

vi.mock('~/commerce/lib/commerce', () => ({
  fetchListingsByIds: vi.fn(),
  searchListingsPage: vi.fn(),
}))

vi.mock('~/commerce/lib/wishlist', () => ({
  fetchWishlistListingIds: vi.fn(),
}))

import { fetchListingsByIds } from '~/commerce/lib/commerce'

const sampleSummary = {
  id: 'listing-1',
  title: 'Silk scarf',
  price: 1200,
  currency: 'INR',
  image_url: 'https://cdn.example/scarf.jpg',
  image_urls: ['https://cdn.example/scarf.jpg'],
  slug: 'silk-scarf',
  shop_name: 'Atelier',
} as Parameters<typeof listingSummaryToPostProduct>[0]

describe('listingSummaryToPostProduct', () => {
  it('maps listing summary fields into PostProduct', () => {
    expect(listingSummaryToPostProduct(sampleSummary)).toEqual({
      listingId: 'listing-1',
      title: 'Silk scarf',
      price: 1200,
      currency: 'INR',
      imageUrl: 'https://cdn.example/scarf.jpg',
      slug: 'silk-scarf',
      shopName: 'Atelier',
      shopId: null,
      shopSlug: null,
      shopOwnerUserId: null,
    })
  })
})

describe('sellerListingToPostProduct', () => {
  it('maps seller row with shop context', () => {
    const product = sellerListingToPostProduct(
      {
        id: 'seller-listing',
        title: 'Handmade mug',
        price: 450,
        primaryImageUrl: 'https://cdn.example/mug.jpg',
        slug: 'handmade-mug',
      } as Parameters<typeof sellerListingToPostProduct>[0],
      'Clay Co',
      'INR',
    )
    expect(product).toMatchObject({
      listingId: 'seller-listing',
      title: 'Handmade mug',
      shopName: 'Clay Co',
      currency: 'INR',
    })
  })
})

describe('togglePostProductAttachment', () => {
  const base: PostProduct = {
    listingId: 'a',
    title: 'A',
    price: 10,
    currency: 'INR',
    imageUrl: null,
    slug: 'a',
    shopName: null,
  }

  it('adds a product when under the cap', () => {
    const result = togglePostProductAttachment([], { ...base, listingId: 'b', title: 'B' })
    expect(result.capped).toBe(false)
    expect(result.products).toHaveLength(1)
    expect(result.products[0].listingId).toBe('b')
  })

  it('removes an already-attached product', () => {
    const result = togglePostProductAttachment([base], base)
    expect(result.products).toHaveLength(0)
    expect(result.capped).toBe(false)
  })

  it(`refuses to exceed ${MAX_ATTACHED_PRODUCTS} attachments`, () => {
    const current: PostProduct[] = [
      { ...base, listingId: '1' },
      { ...base, listingId: '2' },
      { ...base, listingId: '3' },
    ]
    const result = togglePostProductAttachment(current, { ...base, listingId: '4' })
    expect(result.capped).toBe(true)
    expect(result.products).toHaveLength(MAX_ATTACHED_PRODUCTS)
  })
})

describe('fetchAttachProductById', () => {
  beforeEach(() => {
    vi.mocked(fetchListingsByIds).mockReset()
  })

  it('hydrates a PostProduct without requiring a shop', async () => {
    vi.mocked(fetchListingsByIds).mockResolvedValue([sampleSummary])
    const product = await fetchAttachProductById('listing-1')
    expect(fetchListingsByIds).toHaveBeenCalledWith(['listing-1'])
    expect(product?.listingId).toBe('listing-1')
    expect(product?.title).toBe('Silk scarf')
  })

  it('returns null when the listing is missing', async () => {
    vi.mocked(fetchListingsByIds).mockResolvedValue([])
    expect(await fetchAttachProductById('missing')).toBeNull()
  })
})

describe('fetchRecentlyViewedAttachProducts', () => {
  beforeEach(() => {
    vi.mocked(fetchListingsByIds).mockReset()
  })

  it('maps recently viewed ids to PostProduct rows', async () => {
    vi.mocked(fetchListingsByIds).mockResolvedValue([
      {
        id: 'recent-1',
        slug: 'recent-item',
        title: 'Recent item',
        card_title: 'Recent item',
        price: 500,
        currency: 'INR',
        image_url: null,
        image_urls: [],
        images: [],
        shop_name: 'Shop',
        shop_id: 'shop-1',
        listing_type: 'physical',
        average_rating: null,
        total_reviews: null,
      },
    ] as Awaited<ReturnType<typeof fetchListingsByIds>>)

    const { fetchRecentlyViewedAttachProducts } = await import('~/community/lib/attach-listing-products')
    const rows = await fetchRecentlyViewedAttachProducts(['recent-1', 'missing'])
    expect(fetchListingsByIds).toHaveBeenCalledWith(['recent-1', 'missing'])
    expect(rows[0]?.listingId).toBe('recent-1')
    expect(rows[0]?.shopId).toBe('shop-1')
  })
})
