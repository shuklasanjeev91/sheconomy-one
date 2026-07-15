import { commerceRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** `/listing` without a slug has nothing to show — go to the storefront. */
export default function ListingIndexRedirect() {
  return <SpaRedirect href={commerceRoutes.home} />
}
