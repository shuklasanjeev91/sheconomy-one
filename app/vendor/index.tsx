import { vendorRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

export default function VendorIndexRoute() {
  return <SpaRedirect href={vendorRoutes.myShop} />
}
