import { Redirect } from 'one'

import { commerceRoutes } from '~/lib/routes'

/** `/category` without a slug has nothing to show — go to the storefront. */
export default function CategoryIndexRedirect() {
  return <Redirect href={commerceRoutes.home} />
}
