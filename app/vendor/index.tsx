import { Redirect } from 'one'

import { vendorRoutes } from '~/lib/routes'

export default function VendorIndexRoute() {
  return <Redirect href={vendorRoutes.myShop} />
}
