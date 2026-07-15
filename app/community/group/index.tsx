import { communityRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** `/community/group` has no bare page — send visitors to the groups list. */
export default function GroupIndexRedirect() {
  return <SpaRedirect href={communityRoutes.groups} />
}
