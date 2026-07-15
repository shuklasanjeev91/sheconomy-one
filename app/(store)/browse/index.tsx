import { commerceRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** `/browse` without a kind has nothing to show — go to the storefront. */
export default function BrowseIndexRedirect() {
  return <SpaRedirect href={commerceRoutes.home} />
}
