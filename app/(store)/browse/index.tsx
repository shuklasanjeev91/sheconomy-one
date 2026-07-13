import { Redirect } from 'one'

import { commerceRoutes } from '~/lib/routes'

/** `/browse` without a kind has nothing to show — go to the storefront. */
export default function BrowseIndexRedirect() {
  return <Redirect href={commerceRoutes.home} />
}
