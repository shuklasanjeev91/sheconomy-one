import { useLocalSearchParams } from 'one'

import { RequireAuth } from '~/components/auth'
import { SponsoredPaymentResultScreen } from '~/community/screens/SponsoredPaymentResultScreen'

export default function SponsoredPaymentFailureRoute() {
  const params = useLocalSearchParams<{ txn?: string | string[] }>()
  const txn = Array.isArray(params.txn) ? params.txn[0] : params.txn
  return (
    <RequireAuth redirectTo="/community/ads">
      <SponsoredPaymentResultScreen transactionId={txn ?? ''} failed />
    </RequireAuth>
  )
}
