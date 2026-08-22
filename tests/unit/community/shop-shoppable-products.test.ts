import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/community/lib/profile-shoppable-products', () => ({
  fetchProfileShoppableProducts: vi.fn(),
}))

import { fetchProfileShoppableProducts } from '~/community/lib/profile-shoppable-products'
import { fetchShopShoppableProducts } from '~/community/lib/shop-shoppable-products'

describe('fetchShopShoppableProducts', () => {
  beforeEach(() => {
    vi.mocked(fetchProfileShoppableProducts).mockReset()
  })

  it('filters profile products to the requested shop', async () => {
    vi.mocked(fetchProfileShoppableProducts).mockResolvedValue([
      {
        listingId: 'l1',
        title: 'A',
        price: 100,
        currency: 'INR',
        imageUrl: null,
        slug: 'a',
        shopName: 'Shop A',
        shopId: 'shop-a',
      },
      {
        listingId: 'l2',
        title: 'B',
        price: 200,
        currency: 'INR',
        imageUrl: null,
        slug: 'b',
        shopName: 'Shop B',
        shopId: 'shop-b',
      },
      {
        listingId: 'l3',
        title: 'C',
        price: 300,
        currency: 'INR',
        imageUrl: null,
        slug: 'c',
        shopName: 'Shop A',
        shopId: 'shop-a',
      },
    ])

    const rows = await fetchShopShoppableProducts('shop-a', 'user-1', 10)
    expect(fetchProfileShoppableProducts).toHaveBeenCalledWith('user-1', 20)
    expect(rows.map((row) => row.listingId)).toEqual(['l1', 'l3'])
  })

  it('respects the limit after filtering', async () => {
    vi.mocked(fetchProfileShoppableProducts).mockResolvedValue([
      {
        listingId: 'l1',
        title: 'A',
        price: 100,
        currency: 'INR',
        imageUrl: null,
        slug: 'a',
        shopName: 'Shop A',
        shopId: 'shop-a',
      },
      {
        listingId: 'l2',
        title: 'B',
        price: 200,
        currency: 'INR',
        imageUrl: null,
        slug: 'b',
        shopName: 'Shop A',
        shopId: 'shop-a',
      },
    ])

    const rows = await fetchShopShoppableProducts('shop-a', 'user-1', 1)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.listingId).toBe('l1')
  })
})
