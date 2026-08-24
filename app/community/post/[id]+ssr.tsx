import { useLoader } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { DocumentSeoTags } from '~/components/seo/DocumentSeoTags'
import { PostDetailScreen } from '~/community/screens/PostDetailScreen'
import { postSeoLoader } from '~/community/lib/post-seo-loader'
import { getPostShareUrl } from '~/lib/share'

export async function loader(props: Parameters<typeof postSeoLoader>[0]) {
  return postSeoLoader(props)
}

/**
 * SSR post detail — crawlers (WhatsApp / Facebook / LinkedIn) need `og:image`
 * in the first HTML response. The previous `+spa` shell had zero meta tags.
 */
export default function CommunityPostDetailPage() {
  const data = useLoader(loader)

  return (
    <AppErrorBoundary scope="PostDetail">
      {data?.seo ? (
        <DocumentSeoTags
          seo={data.seo}
          url={data.id ? getPostShareUrl(data.id) : undefined}
        />
      ) : null}
      <PostDetailScreen />
    </AppErrorBoundary>
  )
}
