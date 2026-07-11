import { Redirect } from 'one'

import { commerceRoutes } from '~/lib/routes'

/** `/shop` without a slug has nothing to show — go to the shops directory. */
export default function ShopIndexRedirect() {
  return <Redirect href={commerceRoutes.shops} />
}
