import { Redirect } from 'one'

import { communityRoutes } from '~/lib/routes'

/** `/community/post` without an id has nothing to show — go to the feed. */
export default function PostIndexRedirect() {
  return <Redirect href={communityRoutes.home} />
}
