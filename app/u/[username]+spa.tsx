import { useLocalSearchParams } from 'one'

import { CreatorHubScreen } from '~/commerce/screens/CreatorHubScreen'

export default function CreatorHubRoute() {
  const params = useLocalSearchParams<{ username?: string | string[] }>()
  const raw = params.username
  const username = Array.isArray(raw) ? raw[0] ?? '' : raw ?? ''
  return <CreatorHubScreen username={username} />
}
