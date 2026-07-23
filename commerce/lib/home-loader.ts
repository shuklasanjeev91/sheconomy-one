import { fetchHomeBootstrap } from '~/commerce/lib/commerce'
import { seedHomeFeedCaches } from '~/lib/bootstrap/home-feed-cache'

export async function homeLoader() {
  const { data, error, feedSeeds } = await fetchHomeBootstrap()
  if (feedSeeds) {
    seedHomeFeedCaches(feedSeeds)
  }
  return { data, error }
}
