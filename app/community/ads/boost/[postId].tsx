import { useLocalSearchParams } from 'one'

import { RequireAuth } from '~/components/auth'
import { BoostPostScreen } from '~/community/screens/BoostPostScreen'

export default function BoostPostRoute() {
  const params = useLocalSearchParams<{
    postId?: string | string[]
    campaign?: string | string[]
  }>()
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId
  const campaignId = Array.isArray(params.campaign) ? params.campaign[0] : params.campaign

  return (
    <RequireAuth redirectTo={postId ? `/community/ads/boost/${postId}` : '/community'}>
      <BoostPostScreen postId={postId ?? ''} campaignId={campaignId} />
    </RequireAuth>
  )
}
