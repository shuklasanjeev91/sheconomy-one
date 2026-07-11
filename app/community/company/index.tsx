import { Redirect } from 'one'

import { communityRoutes } from '~/lib/routes'

/** `/community/company` has no bare page — send visitors to the companies list. */
export default function CompanyIndexRedirect() {
  return <Redirect href={communityRoutes.companies} />
}
