import { communityRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** `/community/post` without an id has nothing to show — go to the feed. */
export default function PostIndexRedirect() {
  return <SpaRedirect href={communityRoutes.home} />
}
