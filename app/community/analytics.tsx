import { RequireAuth } from '~/components/auth'
import { ProfileAnalyticsScreen } from '~/community/screens/ProfileAnalyticsScreen'

export default function CommunityAnalyticsRoute() {
  return (
    <RequireAuth redirectTo="/community/analytics">
      <ProfileAnalyticsScreen />
    </RequireAuth>
  )
}
