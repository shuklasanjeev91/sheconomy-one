import { Redirect } from 'one'

import { communityRoutes } from '~/lib/routes'

/** `/community/hashtag` without a tag has nothing to show — go to the feed. */
export default function HashtagIndexRedirect() {
  return <Redirect href={communityRoutes.home} />
}
