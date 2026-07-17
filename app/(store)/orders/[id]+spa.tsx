import { useParams } from 'one'

import { RequireAuth } from '~/components/auth/RequireAuth'
import { OrderDetailScreen } from '~/commerce/screens/OrderDetailScreen'
import { PageCenter } from '~/components/layout'
import { Text } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export default function OrderDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const ui = useAppUi()

  if (!id) {
    return (
      <PageCenter>
        <Text color={ui.textSecondary}>Missing order id</Text>
      </PageCenter>
    )
  }

  return (
    <RequireAuth redirectTo={`/orders/${id}`}>
      <OrderDetailScreen orderId={id} />
    </RequireAuth>
  )
}
