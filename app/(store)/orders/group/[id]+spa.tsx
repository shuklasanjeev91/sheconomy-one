import { useParams } from 'one'

import { RequireAuth } from '~/components/auth/RequireAuth'
import { CheckoutGroupDetailScreen } from '~/commerce/screens/CheckoutGroupDetailScreen'
import { PageCenter } from '~/components/layout'
import { Text } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export default function CheckoutGroupDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const ui = useAppUi()

  if (!id) {
    return (
      <PageCenter>
        <Text color={ui.textSecondary}>Missing checkout id</Text>
      </PageCenter>
    )
  }

  return (
    <RequireAuth redirectTo={`/orders/group/${id}`}>
      <CheckoutGroupDetailScreen groupId={id} />
    </RequireAuth>
  )
}
