import { communityRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** `/community/company` has no bare page — send visitors to the companies list. */
export default function CompanyIndexRedirect() {
  return <SpaRedirect href={communityRoutes.companies} />
}
