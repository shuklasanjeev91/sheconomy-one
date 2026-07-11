import { Redirect } from 'one'

import { communityRoutes } from '~/lib/routes'

/** `/community/group` has no bare page — send visitors to the groups list. */
export default function GroupIndexRedirect() {
  return <Redirect href={communityRoutes.groups} />
}
