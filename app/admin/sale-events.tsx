import { SaleEventErrorBoundary } from '~/commerce/components/SaleEventErrorBoundary'
import { useAppDispatch } from '~/lib/store/hooks'
import { loadEvents } from '~/lib/sale-event'

import { AdminSaleEventsManager } from '~/app/admin/components/AdminSaleEventsManager'

export default function AdminSaleEventsPage() {
  const dispatch = useAppDispatch()

  return (
    <SaleEventErrorBoundary scope="AdminSaleEvents" onReset={() => dispatch(loadEvents())}>
      <AdminSaleEventsManager />
    </SaleEventErrorBoundary>
  )
}
