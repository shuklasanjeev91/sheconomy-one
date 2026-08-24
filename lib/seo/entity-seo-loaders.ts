import type { LoaderProps } from 'one'

import { fetchCompanyBySlug } from '~/community/lib/companies'
import { collectPostMedia } from '~/community/lib/post-media'
import { fetchEvent } from '~/community/lib/events'
import { fetchGroup } from '~/community/lib/groups'
import { fetchJob } from '~/community/lib/jobs'
import { fetchPublicProfile } from '~/community/lib/network'
import { fetchProgramBySlug } from '~/class/lib/programs'
import { getContentCoverUrl, getContentTeaser } from '~/lib/cms/cms.utils'
import { BRAND_NAME } from '~/config/brand'
import {
  appRoutes,
  blogRoutes,
  classRoutes,
  commerceRoutes,
  communityRoutes,
} from '~/lib/routes'
import { pageSeo, plainSnippet, readRouteParam } from '~/lib/seo/seo-helpers'
import type { PageSeo } from '~/lib/seo/seo'
import { publishSsrPageSeo } from '~/lib/seo/ssr-page-seo-slot'
import { supabase } from '~/lib/supabase'

export type EntitySeoLoaderResult = {
  seo: PageSeo
} | null

function publish(seo: PageSeo | null): EntitySeoLoaderResult {
  publishSsrPageSeo(seo)
  return seo ? { seo } : null
}

function resolveFromPath(
  params: Record<string, string | string[] | undefined>,
  key: string,
  path: string | undefined,
  pattern: RegExp,
): string {
  const fromParams = readRouteParam(params[key])
  if (fromParams && !fromParams.startsWith(':')) return fromParams
  const match = (path || '').match(pattern)
  if (!match?.[1] || match[1].startsWith(':')) return ''
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export async function profileSeoLoader({
  params,
  path,
}: LoaderProps<{ username?: string }>): Promise<EntitySeoLoaderResult> {
  const handle = resolveFromPath(params ?? {}, 'username', path, /\/(?:profile|u)\/([^/?#]+)/i)
  if (!handle) return publish(null)

  const { data } = await fetchPublicProfile(handle)
  if (!data) {
    return publish(pageSeo({ title: 'Profile', type: 'profile' }))
  }

  const name = data.full_name || data.username || 'Member'
  return publish(
    pageSeo({
      title: name,
      description:
        data.headline?.trim() ||
        plainSnippet(data.bio) ||
        `See ${name}'s profile on ${BRAND_NAME}.`,
      image: data.avatar_url ?? data.cover_url,
      type: 'profile',
      canonicalPath: String(appRoutes.userProfile(data.username || handle)),
    }),
  )
}

export async function creatorHubSeoLoader(
  props: LoaderProps<{ username?: string }>,
): Promise<EntitySeoLoaderResult> {
  // Same profile card, different canonical URL (/u/...).
  const result = await profileSeoLoader(props)
  if (!result?.seo) return result
  const handle = resolveFromPath(
    props.params ?? {},
    'username',
    props.path,
    /\/u\/([^/?#]+)/i,
  )
  if (!handle) return result
  const seo = {
    ...result.seo,
    title: result.seo.title,
    description:
      result.seo.description ||
      `Shop and follow ${result.seo.title} on ${BRAND_NAME}.`,
    canonicalPath: String(commerceRoutes.creatorHub(handle)),
  }
  return publish(seo)
}

export async function profileShopSeoLoader({
  params,
  path,
}: LoaderProps<{ username?: string }>): Promise<EntitySeoLoaderResult> {
  const handle = resolveFromPath(
    params ?? {},
    'username',
    path,
    /\/profile\/([^/?#]+)\/shop/i,
  )
  if (!handle) return publish(null)

  const { data } = await fetchPublicProfile(handle)
  if (!data) {
    return publish(pageSeo({ title: 'Shop from posts' }))
  }

  const name = data.full_name || data.username || 'Member'
  return publish(
    pageSeo({
      title: `Shop from ${name}'s posts`,
      description: `Products ${name} has shared in community posts on ${BRAND_NAME}.`,
      image: data.avatar_url ?? data.cover_url,
      canonicalPath: String(communityRoutes.profileShop(data.username || handle)),
    }),
  )
}

export async function companySeoLoader({
  params,
  path,
}: LoaderProps<{ slug?: string }>): Promise<EntitySeoLoaderResult> {
  const slug = resolveFromPath(params ?? {}, 'slug', path, /\/community\/company\/([^/?#]+)/i)
  if (!slug) return publish(null)

  const { data } = await fetchCompanyBySlug(slug)
  if (!data) return publish(pageSeo({ title: 'Company' }))

  return publish(
    pageSeo({
      title: data.name,
      description:
        data.tagline?.trim() ||
        `${data.name} — ${data.industry || 'company'} on ${BRAND_NAME}.`,
      image: data.logo_url ?? data.cover_url,
      canonicalPath: String(communityRoutes.company(data.id || slug)),
    }),
  )
}

export async function eventSeoLoader({
  params,
  path,
}: LoaderProps<{ id?: string }>): Promise<EntitySeoLoaderResult> {
  const id = resolveFromPath(params ?? {}, 'id', path, /\/community\/events\/([^/?#]+)/i)
  if (!id) return publish(null)

  const { data } = await fetchEvent(id)
  if (!data) return publish(pageSeo({ title: 'Event' }))

  return publish(
    pageSeo({
      title: data.title,
      description:
        plainSnippet(data.description) || `Join this event on ${BRAND_NAME}.`,
      image: data.image_url,
      canonicalPath: String(communityRoutes.event(data.id)),
    }),
  )
}

export async function groupSeoLoader({
  params,
  path,
}: LoaderProps<{ id?: string }>): Promise<EntitySeoLoaderResult> {
  const id = resolveFromPath(params ?? {}, 'id', path, /\/community\/group\/([^/?#]+)/i)
  if (!id) return publish(null)

  const { data } = await fetchGroup(id)
  if (!data) return publish(pageSeo({ title: 'Group' }))

  const name = data.title || data.name || 'Group'
  return publish(
    pageSeo({
      title: name,
      description:
        plainSnippet(data.description) || `Join the ${name} group on ${BRAND_NAME}.`,
      image: data.cover_url ?? data.avatar_url,
      canonicalPath: String(communityRoutes.group(data.id)),
    }),
  )
}

export async function jobSeoLoader({
  params,
  path,
}: LoaderProps<{ id?: string }>): Promise<EntitySeoLoaderResult> {
  const id = resolveFromPath(params ?? {}, 'id', path, /\/community\/jobs\/([^/?#]+)/i)
  if (!id) return publish(null)

  const { data } = await fetchJob(id)
  if (!data) return publish(pageSeo({ title: 'Job' }))

  return publish(
    pageSeo({
      title: `${data.title} at ${data.company_name}`,
      description:
        plainSnippet(data.description) ||
        `${data.title} — ${data.location}${data.is_remote ? ' (Remote)' : ''}. Apply on ${BRAND_NAME}.`,
      image: data.company_logo,
      canonicalPath: String(communityRoutes.job(data.id)),
    }),
  )
}

export async function articleSeoLoader({
  params,
  path,
}: LoaderProps<{ id?: string }>): Promise<EntitySeoLoaderResult> {
  const id = resolveFromPath(params ?? {}, 'id', path, /\/community\/article\/([^/?#]+)/i)
  if (!id) return publish(null)

  const { data, error } = await supabase
    .from('posts_with_stats')
    .select(
      'id, content, image_url, image_urls, media_urls, video_url, video_urls, author_name, author_avatar',
    )
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle()

  if (error || !data) return publish(pageSeo({ title: 'Article', type: 'article' }))

  const media = collectPostMedia({
    image_url: data.image_url,
    image_urls: Array.isArray(data.image_urls) ? data.image_urls : [],
    media_urls: Array.isArray(data.media_urls) ? data.media_urls : [],
    video_url: data.video_url,
    video_urls: Array.isArray(data.video_urls) ? data.video_urls : [],
  })
  const image =
    media.find((item) => item.kind === 'image')?.url ??
    media[0]?.url ??
    (typeof data.author_avatar === 'string' ? data.author_avatar : null)

  const author = (data.author_name || 'Community member').trim()
  const snippet = plainSnippet(data.content)

  return publish(
    pageSeo({
      title: snippet ? snippet.slice(0, 80) : `Article by ${author}`,
      description: snippet || undefined,
      image,
      type: 'article',
      canonicalPath: String(communityRoutes.article(data.id)),
    }),
  )
}

export async function hashtagSeoLoader({
  params,
  path,
}: LoaderProps<{ tag?: string }>): Promise<EntitySeoLoaderResult> {
  const raw = resolveFromPath(params ?? {}, 'tag', path, /\/community\/hashtag\/([^/?#]+)/i)
  const tag = decodeURIComponent(raw).replace(/^#/, '').trim()
  if (!tag) return publish(null)

  return publish(
    pageSeo({
      title: `#${tag}`,
      description: `Posts tagged #${tag} from the ${BRAND_NAME} community.`,
      canonicalPath: String(communityRoutes.hashtag(tag)),
    }),
  )
}

export async function blogPostSeoLoader({
  params,
  path,
}: LoaderProps<{ slug?: string }>): Promise<EntitySeoLoaderResult> {
  const slug = resolveFromPath(params ?? {}, 'slug', path, /\/blog\/([^/?#]+)/i)
  if (!slug || slug.toLowerCase() === 'index') return publish(null)

  const { data, error } = await supabase
    .from('cms_content')
    .select(
      'slug, title, seo_title, seo_description, excerpt, body, cover_media:cms_media!cover_image_id(public_url)',
    )
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return publish(pageSeo({ title: 'Blog', type: 'article' }))

  const cover = getContentCoverUrl(data as Parameters<typeof getContentCoverUrl>[0])
  const teaser = getContentTeaser(data as Parameters<typeof getContentTeaser>[0], 220)

  return publish(
    pageSeo({
      title: data.seo_title || data.title,
      description: data.seo_description || teaser || undefined,
      image: cover || null,
      type: 'article',
      canonicalPath: String(blogRoutes.post(data.slug || slug)),
    }),
  )
}

export async function programSeoLoader({
  params,
  path,
}: LoaderProps<{ slug?: string }>): Promise<EntitySeoLoaderResult> {
  const slug = resolveFromPath(params ?? {}, 'slug', path, /\/class\/([^/?#]+)/i)
  if (!slug) return publish(null)

  const { program } = await fetchProgramBySlug(slug)
  if (!program) return publish(pageSeo({ title: 'Class' }))

  return publish(
    pageSeo({
      title: program.title,
      description:
        plainSnippet(program.description) ||
        `Watch or listen to ${program.title} on ${BRAND_NAME} Classes.`,
      image: program.image_url,
      canonicalPath: String(classRoutes.program(program.seo_slug || program.id || slug)),
    }),
  )
}
