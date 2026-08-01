import { fetchHomeBootstrap } from '~/commerce/lib/commerce'
import { seedHomeFeedCaches } from '~/lib/bootstrap/home-feed-cache'
import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import { writeAppCache } from '~/lib/cache/app-cache'

/** Always fetch fresh home bootstrap; persist for next cold start / offline paint. */
export async function homeLoader() {
  const { data, error, feedSeeds } = await fetchHomeBootstrap()
  if (feedSeeds) {
    seedHomeFeedCaches(feedSeeds)
  }
  const payload = { data, error }
  void writeAppCache(CACHE_KEYS.home, payload)
  return payload
}
