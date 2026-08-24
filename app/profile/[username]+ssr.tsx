import { useLoader } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { PublicProfileScreen } from '~/community/screens/PublicProfileScreen'
import { profileSeoLoader } from '~/lib/seo/entity-seo-loaders'

export async function loader(props: Parameters<typeof profileSeoLoader>[0]) {
  return profileSeoLoader(props)
}

export default function PublicProfilePage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)
  return (
    <AppErrorBoundary scope="PublicProfile">
      <PublicProfileScreen />
    </AppErrorBoundary>
  )
}
