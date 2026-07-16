import { commerceRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** `/category` without a slug has nothing to show — go to the storefront. */
export default function CategoryIndexRedirect() {
  return <SpaRedirect href={commerceRoutes.home} />
}
