import { VendorOrderErrorBoundary } from '~/commerce/components/VendorOrderErrorBoundary'
import { VendorOrdersScreen } from '~/commerce/screens/vendor/VendorOrdersScreen'

export default function VendorOrdersRoute() {
  return (
    <VendorOrderErrorBoundary scope="VendorOrders">
      <VendorOrdersScreen />
    </VendorOrderErrorBoundary>
  )
}
