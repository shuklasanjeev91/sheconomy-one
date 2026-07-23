import { writeAppCache } from '~/lib/cache/app-cache'
import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import type { ListingSummary, PaginatedResult, ShopSummary } from '~/commerce/lib/commerce'

type FeedSnapshot<T> = {
  items: T[]
  page: number
  hasMore: boolean
}

function toSnapshot<T>(result: PaginatedResult<T>): FeedSnapshot<T> {
  return {
    items: result.items,
    page: 0,
    hasMore: result.hasMore,
  }
}

/** Write first-page home feeds so section hooks reuse bootstrap work. */
export function seedHomeFeedCaches(input: {
  shops: PaginatedResult<ShopSummary>
  physical: PaginatedResult<ListingSummary>
  digital: PaginatedResult<ListingSummary>
  trending: PaginatedResult<ListingSummary>
}): void {
  if (!input.shops.error) {
    void writeAppCache(CACHE_KEYS.shops, toSnapshot(input.shops))
  }
  if (!input.physical.error) {
    void writeAppCache(CACHE_KEYS.listingFeed('physical'), toSnapshot(input.physical))
  }
  if (!input.digital.error) {
    void writeAppCache(CACHE_KEYS.listingFeed('digital'), toSnapshot(input.digital))
  }
  if (!input.trending.error) {
    void writeAppCache(CACHE_KEYS.listingFeed('trending'), toSnapshot(input.trending))
  }
}
