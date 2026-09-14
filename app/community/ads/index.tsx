import { RequireAuth } from '~/components/auth'
import { SponsoredAdsManagerScreen } from '~/community/screens/SponsoredAdsManagerScreen'

export default function SponsoredAdsRoute() {
  return (
    <RequireAuth redirectTo="/community/ads">
      <SponsoredAdsManagerScreen />
    </RequireAuth>
  )
}
