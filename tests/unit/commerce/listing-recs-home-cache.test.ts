import { afterEach, describe, expect, it } from 'vitest'

import { clearAppCache, writeAppCache } from '~/lib/cache/app-cache'
import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import { listingCardsFromHomeCache } from '~/commerce/lib/listing-recommendations'
import type { ListingSummary } from '~/lib/supabase/commerce'

function fakeListing(id: string, title: string): ListingSummary {
  return {
    id,
    slug: id,
    title,
    card_title: title,
    price: 100,
    listing_type: 'physical',
    average_rating: 4,
    total_reviews: 1,
    image_url: `https://example.com/${id}.jpg`,
    image_urls: [`https://example.com/${id}.jpg`],
    images: [],
    shop_name: 'Shop',
    currency: 'INR',
  }
}

describe('listingCardsFromHomeCache', () => {
  afterEach(async () => {
    await clearAppCache()
  })

  it('returns warmed home feed cards excluding the current listing', async () => {
    await writeAppCache(CACHE_KEYS.listingFeed('trending'), {
      items: [fakeListing('a', 'A'), fakeListing('b', 'B'), fakeListing('c', 'C')],
      page: 0,
      hasMore: false,
    })

    const items = listingCardsFromHomeCache('b', 6)
    expect(items.map((row) => row.id)).toEqual(['a', 'c'])
  })
})
