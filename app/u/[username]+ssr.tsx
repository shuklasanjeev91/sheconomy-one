import { useLoader, useLocalSearchParams } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { CreatorHubScreen } from '~/commerce/screens/CreatorHubScreen'
import { creatorHubSeoLoader } from '~/lib/seo/entity-seo-loaders'

export async function loader(props: Parameters<typeof creatorHubSeoLoader>[0]) {
  return creatorHubSeoLoader(props)
}

export default function CreatorHubPage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)
  const params = useLocalSearchParams<{ username?: string | string[] }>()
  const raw = params.username
  const username = Array.isArray(raw) ? raw[0] ?? '' : raw ?? ''
  return (
    <AppErrorBoundary scope="CreatorHub">
      <CreatorHubScreen username={username} />
    </AppErrorBoundary>
  )
}
