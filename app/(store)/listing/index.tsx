import { Redirect } from 'one'

import { commerceRoutes } from '~/lib/routes'

/** `/listing` without a slug has nothing to show — go to the storefront. */
export default function ListingIndexRedirect() {
  return <Redirect href={commerceRoutes.home} />
}
