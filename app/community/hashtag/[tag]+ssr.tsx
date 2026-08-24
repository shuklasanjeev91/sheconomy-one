import { useLoader } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { HashtagFeedScreen } from '~/community/screens/HashtagFeedScreen'
import { hashtagSeoLoader } from '~/lib/seo/entity-seo-loaders'

export async function loader(props: Parameters<typeof hashtagSeoLoader>[0]) {
  return hashtagSeoLoader(props)
}

export default function HashtagPage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)
  return (
    <AppErrorBoundary scope="Hashtag">
      <HashtagFeedScreen />
    </AppErrorBoundary>
  )
}
