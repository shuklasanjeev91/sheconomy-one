import { useLoader } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { PostDetailScreen } from '~/community/screens/PostDetailScreen'
import { postSeoLoader } from '~/community/lib/post-seo-loader'

export async function loader(props: Parameters<typeof postSeoLoader>[0]) {
  return postSeoLoader(props)
}

/**
 * SSR post detail — crawlers (WhatsApp / Facebook / LinkedIn) need `og:image`
 * in the first HTML response. The previous `+spa` shell had zero meta tags.
 */
export default function CommunityPostDetailPage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)

  return (
    <AppErrorBoundary scope="PostDetail">
      <PostDetailScreen />
    </AppErrorBoundary>
  )
}
