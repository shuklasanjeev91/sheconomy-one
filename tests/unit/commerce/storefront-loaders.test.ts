import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()

vi.mock('~/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { fetchListingDetail } from '~/commerce/lib/listing-loader'
import { fetchShopDetail } from '~/commerce/lib/shop-loader'

describe('storefront loaders', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('listing loader returns error envelope when missing', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const limit = vi.fn(() => ({ maybeSingle, data: Promise.resolve({ data: [], error: null }) }))
    // Make limit thenable for `.limit(300)` without maybeSingle
    Object.assign(limit, {
      then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    })
    const chain: Record<string, unknown> = {}
    const self = () => chain
    Object.assign(chain, {
      eq: vi.fn(self),
      ilike: vi.fn(self),
      limit: vi.fn(() => ({
        maybeSingle,
        then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      })),
      maybeSingle,
    })
    fromMock.mockReturnValue({
      select: vi.fn(() => chain),
    })

    const result = await fetchListingDetail('missing-slug-xyz')
    expect(result.data).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('listing loader returns data on happy path', async () => {
    const listing = {
      id: '11111111-1111-1111-1111-111111111111',
      slug: 'test-mug',
      title: 'Test Mug',
      description: 'Nice mug',
      price: 100,
      listing_type: 'physical',
      listing_status: 'active',
      is_active: true,
      average_rating: 5,
      total_reviews: 1,
      stock: 10,
      quantity: 10,
      category: null,
      tags: null,
      shop_id: 'shop-1',
      created_at: new Date().toISOString(),
      sku: null,
      weight: null,
      dimensions: null,
      listing_metadata: null,
      mrp: null,
      price_includes_tax: null,
      tax_percent: null,
      product_info: null,
      digital_file_url: null,
      digital_file_type: null,
      digital_file_size: null,
      download_limit: null,
      shipping_required: true,
      listing_images: [],
      listing_variations: [],
      listing_attributes: [],
      listing_delivery_profiles: [],
      shops: null,
    }

    const maybeSingle = vi.fn().mockResolvedValue({ data: listing, error: null })
    const eq = vi.fn(() => ({ eq, maybeSingle }))
    fromMock.mockReturnValue({
      select: vi.fn(() => ({ eq })),
    })

    const result = await fetchListingDetail('test-mug')
    expect(result.error).toBeNull()
    expect(result.data?.title).toBe('Test Mug')
  })

  it('shop loader returns error envelope when missing', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn(() => ({
      eq,
      maybeSingle,
      ilike: vi.fn(() => ({ maybeSingle })),
      limit,
    }))
    fromMock.mockReturnValue({
      select: vi.fn(() => ({
        eq,
        maybeSingle,
        ilike: vi.fn(() => ({ maybeSingle })),
        limit,
      })),
    })

    const result = await fetchShopDetail('missing-shop')
    expect(result.data).toBeNull()
    expect(result.error).toMatch(/not found/i)
  })

  it('shop loader returns data on happy path', async () => {
    const shop = {
      id: '22222222-2222-2222-2222-222222222222',
      shop_name: 'Test Shop',
      shop_description: 'Hello',
      logo_url: null,
      shop_email: null,
      shop_phone_number: null,
      shop_currency: 'INR',
      average_rating: 5,
      total_reviews: 1,
      verified: true,
      is_active: true,
      user_id: '33333333-3333-3333-3333-333333333333',
      slug: 'test-shop',
      website_url: null,
      created_at: new Date().toISOString(),
      shop_metadata: null,
      shop_addresses: null,
    }

    const maybeSingle = vi.fn().mockResolvedValue({ data: shop, error: null })
    const eq = vi.fn(() => ({ eq, maybeSingle }))
    fromMock.mockReturnValue({
      select: vi.fn(() => ({ eq, maybeSingle })),
    })

    const result = await fetchShopDetail('test-shop')
    expect(result.error).toBeNull()
    expect(result.data?.shop_name).toBe('Test Shop')
  })
})
