import type { LoaderProps } from 'one'

import { collectPostMedia } from '~/community/lib/post-media'
import { BRAND_NAME } from '~/config/brand'
import { communityRoutes } from '~/lib/routes'
import type { PageSeo } from '~/lib/seo/seo'
import { publishSsrPageSeo } from '~/lib/seo/ssr-page-seo-slot'
import { supabase } from '~/lib/supabase'

export type PostSeoLoaderResult = {
  id: string
  seo: PageSeo
} | null

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function resolvePostId(params: { id?: string | string[] }, path?: string): string {
  const fromParams = readParam(params.id)
  if (fromParams && fromParams !== ':id') return fromParams
  const match = (path || '').match(/\/community\/post\/([^/?#]+)/i)
  if (!match?.[1] || match[1] === ':id') return ''
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function normalizeUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
}

/**
 * Lightweight SSR loader so social crawlers (WhatsApp, Facebook, …) receive
 * real `og:image` / title / description in the initial HTML — SPA shells have none.
 */
export async function postSeoLoader({
  params,
  path,
}: LoaderProps<{ id?: string }>): Promise<PostSeoLoaderResult> {
  const id = resolvePostId(params ?? {}, path)
  if (!id) {
    publishSsrPageSeo(null)
    return null
  }

  const { data, error } = await supabase
    .from('posts_with_stats')
    .select(
      'id, content, image_url, image_urls, media_urls, video_url, video_urls, author_name, author_avatar, post_type',
    )
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle()

  if (error || !data) {
    const fallback: PageSeo = { title: 'Post', type: 'article' }
    publishSsrPageSeo(fallback)
    return { id, seo: fallback }
  }

  const media = collectPostMedia({
    image_url: data.image_url,
    image_urls: normalizeUrlList(data.image_urls),
    media_urls: normalizeUrlList(data.media_urls),
    video_url: data.video_url,
    video_urls: normalizeUrlList(data.video_urls),
  })
  const image =
    media.find((item) => item.kind === 'image')?.url ??
    media[0]?.url ??
    (typeof data.author_avatar === 'string' ? data.author_avatar : null)

  const author = (data.author_name || 'Community member').trim()
  const snippet = String(data.content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)

  const title = author
  const description =
    snippet ||
    `See this post from ${author} on ${BRAND_NAME} — marketplace and community for women.`

  const seo: PageSeo = {
    title,
    description,
    image,
    type: 'article',
    canonicalPath: String(communityRoutes.post(id)),
  }

  publishSsrPageSeo(seo)

  return {
    id,
    seo,
  }
}
