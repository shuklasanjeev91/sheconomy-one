import { useLoader, useLocalSearchParams, useParams, usePathname } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { BlogDetailScreen } from '~/blog/screens/BlogDetailScreen'
import { blogPostSeoLoader } from '~/lib/seo/entity-seo-loaders'

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function useBlogSlug(): string {
  const routeParams = useParams<{ slug?: string | string[] }>()
  const localParams = useLocalSearchParams<{ slug?: string | string[] }>()
  const pathname = usePathname() ?? ''

  const fromParams = readParam(routeParams.slug) || readParam(localParams.slug)
  if (fromParams) {
    try {
      return decodeURIComponent(fromParams)
    } catch {
      return fromParams
    }
  }

  const match = pathname.match(/\/blog\/([^/?#]+)/i)
  if (!match?.[1] || match[1].toLowerCase() === 'index') return ''
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export async function loader(props: Parameters<typeof blogPostSeoLoader>[0]) {
  return blogPostSeoLoader(props)
}

export default function BlogPostPage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)
  const slug = useBlogSlug()
  return (
    <AppErrorBoundary scope="BlogDetail">
      <BlogDetailScreen slug={slug} />
    </AppErrorBoundary>
  )
}
