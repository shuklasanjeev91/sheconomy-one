import { useLocalSearchParams } from 'one'

import { RequireAuth } from '~/components/auth'
import { SponsoredCampaignDetailScreen } from '~/community/screens/SponsoredCampaignDetailScreen'

export default function SponsoredCampaignRoute() {
  const params = useLocalSearchParams<{ campaignId?: string | string[] }>()
  const campaignId = Array.isArray(params.campaignId) ? params.campaignId[0] : params.campaignId

  return (
    <RequireAuth redirectTo="/community/ads">
      <SponsoredCampaignDetailScreen campaignId={campaignId ?? ''} />
    </RequireAuth>
  )
}
