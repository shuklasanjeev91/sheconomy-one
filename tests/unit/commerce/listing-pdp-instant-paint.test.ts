import { afterEach, describe, expect, it } from 'vitest'

import {
  listingLoaderResultFromSummary,
  listingRowFromSummary,
} from '~/commerce/lib/listing-loader'
import {
  clearNativeLoaderCache,
  prefetchNativeLoader,
  readNativeLoaderCache,
  seedNativeLoaderCache,
} from '~/lib/bootstrap/native-loader-cache'

describe('listing PDP instant paint', () => {
  afterEach(() => {
    clearNativeLoaderCache()
  })

  it('builds a paint-ready row from card summary', () => {
    const row = listingRowFromSummary({
      id: 'd43e4e49-1264-49a9-964a-0b4bae5e9b75',
      slug: 'red-striped-table-mat-corner-lotus-online',
      title: 'Red Stripped Table Mat',
      price: 499,
      listing_type: 'physical',
      image_url: 'https://example.com/a.jpg',
      shop_id: 'shop-1',
      shop_name: 'Demo Shop',
      currency: 'INR',
    })

    expect(row.id).toBe('d43e4e49-1264-49a9-964a-0b4bae5e9b75')
    expect(row.title).toBe('Red Stripped Table Mat')
    expect(row.listing_images).toHaveLength(1)
    expect(row.shops?.shop_name).toBe('Demo Shop')
  })

  it('seeds cache then upgrades via prefetch without blocking', async () => {
    const key = 'route:listing:test'
    const seed = listingLoaderResultFromSummary({
      id: 'd43e4e49-1264-49a9-964a-0b4bae5e9b75',
      title: 'Seed',
      price: 10,
      listing_type: 'physical',
    })

    seedNativeLoaderCache(key, seed)
    expect(readNativeLoaderCache<typeof seed>(key)?.data?.data?.title).toBe('Seed')

    let resolved = false
    prefetchNativeLoader(key, async () => {
      await new Promise((r) => setTimeout(r, 20))
      resolved = true
      return listingLoaderResultFromSummary({
        id: 'd43e4e49-1264-49a9-964a-0b4bae5e9b75',
        title: 'Full',
        price: 10,
        listing_type: 'physical',
      })
    })

    expect(readNativeLoaderCache<typeof seed>(key)?.data?.data?.title).toBe('Seed')
    await readNativeLoaderCache<typeof seed>(key)?.promise
    expect(resolved).toBe(true)
    expect(readNativeLoaderCache<typeof seed>(key)?.data?.data?.title).toBe('Full')
  })
})
