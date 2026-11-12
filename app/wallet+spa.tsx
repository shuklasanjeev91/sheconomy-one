import { RequireAuth } from '~/components/auth/RequireAuth'
import { BuyerWalletScreen } from '~/commerce/screens/BuyerWalletScreen'

export default function WalletRoute() {
  return (
    <RequireAuth redirectTo="/wallet">
      <BuyerWalletScreen />
    </RequireAuth>
  )
}
