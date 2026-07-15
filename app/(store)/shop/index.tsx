import { commerceRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** `/shop` without a slug has nothing to show — go to the shops directory. */
export default function ShopIndexRedirect() {
  return <SpaRedirect href={commerceRoutes.shops} />
}
