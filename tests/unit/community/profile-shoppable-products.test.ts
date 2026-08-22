import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('~/commerce/lib/commerce', () => ({
  fetchListingsByIds: vi.fn(),
}))

import { fetchListingsByIds } from '~/commerce/lib/commerce'
import { fetchProfileShoppableProducts } from '~/community/lib/profile-shoppable-products'
import { supabase } from '~/lib/supabase/client'

describe('fetchProfileShoppableProducts', () => {
  beforeEach(() => {
    vi.mocked(supabase.from).mockReset()
    vi.mocked(fetchListingsByIds).mockReset()
  })

  it('deduplicates listing ids across recent posts', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          post_data: {
            attached_products: [{ listingId: 'listing-1' }, { listingId: 'listing-2' }],
          },
        },
        {
          post_data: {
            attached_products: [{ listingId: 'listing-1' }],
            product_data: { listingId: 'listing-3' },
          },
        },
      ],
      error: null,
    })
    const order = vi.fn().mockReturnValue({ limit })
    const eqDeleted = vi.fn().mockReturnValue({ order })
    const eqUser = vi.fn().mockReturnValue({ eq: eqDeleted })
    const select = vi.fn().mockReturnValue({ eq: eqUser })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    vi.mocked(fetchListingsByIds).mockResolvedValue([
      {
        id: 'listing-1',
        title: 'One',
        price: 100,
        currency: 'INR',
        image_url: null,
        image_urls: [],
        images: [],
        slug: 'one',
        shop_name: 'Shop',
      },
      {
        id: 'listing-2',
        title: 'Two',
        price: 200,
        currency: 'INR',
        image_url: null,
        image_urls: [],
        images: [],
        slug: 'two',
        shop_name: 'Shop',
      },
      {
        id: 'listing-3',
        title: 'Three',
        price: 300,
        currency: 'INR',
        image_url: null,
        image_urls: [],
        images: [],
        slug: 'three',
        shop_name: 'Shop',
      },
    ] as never)

    const products = await fetchProfileShoppableProducts('user-1', 12)

    expect(fetchListingsByIds).toHaveBeenCalledWith(['listing-1', 'listing-2', 'listing-3'])
    expect(products).toHaveLength(3)
    expect(products[0]?.listingId).toBe('listing-1')
  })
})
