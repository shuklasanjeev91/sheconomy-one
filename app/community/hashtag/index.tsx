import { communityRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** `/community/hashtag` without a tag has nothing to show — go to the feed. */
export default function HashtagIndexRedirect() {
  return <SpaRedirect href={communityRoutes.home} />
}
