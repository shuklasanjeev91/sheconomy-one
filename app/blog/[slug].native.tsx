import { useLocalSearchParams, useParams, usePathname } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { BlogDetailScreen } from '~/blog/screens/BlogDetailScreen'

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

export default function BlogPostPage() {
  const slug = useBlogSlug()
  return (
    <AppErrorBoundary scope="BlogDetail">
      <BlogDetailScreen slug={slug} />
    </AppErrorBoundary>
  )
}
