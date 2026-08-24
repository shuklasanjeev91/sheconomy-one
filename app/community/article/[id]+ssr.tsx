import { useLoader } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { ArticleDetailScreen } from '~/community/screens/ArticleDetailScreen'
import { articleSeoLoader } from '~/lib/seo/entity-seo-loaders'

export async function loader(props: Parameters<typeof articleSeoLoader>[0]) {
  return articleSeoLoader(props)
}

export default function ArticlePage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)
  return (
    <AppErrorBoundary scope="Article">
      <ArticleDetailScreen />
    </AppErrorBoundary>
  )
}
