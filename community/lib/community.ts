import { supabase } from '~/lib/supabase/client'

import { extractHashtags, extractMentions } from './post-text'

export const COMMUNITY_PAGE_SIZE = 10

export type CommunityAuthor = {
  full_name: string | null
  username: string | null
  avatar_url: string | null
  headline: string | null
}

export type PostCompanyContext = {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

export type PostGroupContext = {
  id: string
  name: string
  title: string
  avatar_url: string | null
}

export type FeedSort = 'top' | 'recent'

export type CommunityPost = {
  id: string
  content: string
  image_url: string | null
  media_urls: string[] | null
  created_at: string | null
  post_type: string | null
  user_id: string | null
  company_id: string | null
  group_id: string | null
  like_count: number | null
  comment_count: number | null
  engagement_score: number | null
  total_reactions: number | null
  author_verified: boolean | null
  author: CommunityAuthor | null
  company: PostCompanyContext | null
  group: PostGroupContext | null
  event_title: string | null
  event_description: string | null
  event_start_time: string | null
  event_end_time: string | null
  event_location: string | null
  event_rsvp_enabled: boolean | null
}

export type PaginatedPostsResult = {
  items: CommunityPost[]
  page: number
  pageSize: number
  hasMore: boolean
  error: string | null
}

export type CreatePostInput = {
  content: string
  imageUrl?: string | null
  companyId?: string | null
  groupId?: string | null
  postType?: string | null
  eventTitle?: string | null
  eventDescription?: string | null
  eventStartTime?: string | null
  eventEndTime?: string | null
  eventLocation?: string | null
  eventRsvpEnabled?: boolean
}

const POST_STATS_SELECT =
  'id, content, image_url, media_urls, created_at, post_type, user_id, like_count, total_comments, engagement_score, total_reactions, author_verified, author_name, author_headline, author_avatar, event_title, event_description, event_start_time, event_end_time, event_location, event_rsvp_enabled'

type PostRow = {
  id: string
  content: string | null
  image_url: string | null
  media_urls: string[] | null
  created_at: string | null
  post_type: string | null
  user_id: string | null
  like_count: number | null
  total_comments: number | null
  engagement_score: number | null
  total_reactions: number | null
  author_verified: boolean | null
  author_name: string | null
  author_headline: string | null
  author_avatar: string | null
  event_title: string | null
  event_description: string | null
  event_start_time: string | null
  event_end_time: string | null
  event_location: string | null
  event_rsvp_enabled: boolean | null
}

function mapPost(row: PostRow, username?: string | null): CommunityPost {
  return {
    id: row.id,
    content: row.content ?? '',
    image_url: row.image_url,
    media_urls: row.media_urls,
    created_at: row.created_at,
    post_type: row.post_type,
    user_id: row.user_id,
    company_id: null,
    group_id: null,
    like_count: row.total_reactions ?? row.like_count,
    comment_count: row.total_comments,
    engagement_score: row.engagement_score,
    total_reactions: row.total_reactions,
    author_verified: row.author_verified,
    author: {
      full_name: row.author_name,
      username: username ?? null,
      avatar_url: row.author_avatar,
      headline: row.author_headline,
    },
    company: null,
    group: null,
    event_title: row.event_title,
    event_description: row.event_description,
    event_start_time: row.event_start_time,
    event_end_time: row.event_end_time,
    event_location: row.event_location,
    event_rsvp_enabled: row.event_rsvp_enabled,
  }
}

async function enrichPostsWithUsernames(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const userIds = [...new Set(posts.map((post) => post.user_id).filter(Boolean))] as string[]
  if (!userIds.length) return posts

  const { data } = await supabase.from('profiles').select('id, username').in('id', userIds)
  const usernameById = new Map((data ?? []).map((profile) => [profile.id, profile.username]))

  return posts.map((post) => ({
    ...post,
    author: post.author
      ? { ...post.author, username: post.user_id ? usernameById.get(post.user_id) ?? null : null }
      : null,
  }))
}

async function enrichPostsWithPostMeta(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const ids = posts.map((post) => post.id).filter(Boolean)
  if (!ids.length) return posts

  const { data } = await supabase.from('posts').select('id, company_id, group_id').in('id', ids)
  const metaById = new Map((data ?? []).map((row) => [row.id, row]))

  return posts.map((post) => {
    const meta = metaById.get(post.id)
    return {
      ...post,
      company_id: meta?.company_id ?? null,
      group_id: meta?.group_id ?? null,
    }
  })
}

async function enrichPostsWithContext(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const companyIds = [...new Set(posts.map((p) => p.company_id).filter(Boolean))] as string[]
  const groupIds = [...new Set(posts.map((p) => p.group_id).filter(Boolean))] as string[]

  const [companiesRes, groupsRes] = await Promise.all([
    companyIds.length
      ? supabase
          .from('companypages')
          .select('id, name, page_slug, logo_url')
          .in('id', companyIds)
      : Promise.resolve({ data: [] }),
    groupIds.length
      ? supabase.from('groups').select('id, name, title, avatar_url').in('id', groupIds)
      : Promise.resolve({ data: [] }),
  ])

  const companyById = new Map(
    (companiesRes.data ?? []).map((c) => [
      c.id,
      { id: c.id, name: c.name, slug: c.page_slug, logo_url: c.logo_url },
    ]),
  )
  const groupById = new Map(
    (groupsRes.data ?? []).map((g) => [
      g.id,
      { id: g.id, name: g.name, title: g.title, avatar_url: g.avatar_url },
    ]),
  )

  return posts.map((post) => ({
    ...post,
    company: post.company_id ? companyById.get(post.company_id) ?? null : null,
    group: post.group_id ? groupById.get(post.group_id) ?? null : null,
  }))
}

async function enrichPosts(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const withMeta = await enrichPostsWithPostMeta(posts)
  const withUsernames = await enrichPostsWithUsernames(withMeta)
  return enrichPostsWithContext(withUsernames)
}

type PostFilter = {
  companyId?: string
  groupId?: string
}

async function fetchPostsPage(
  page: number,
  pageSize: number,
  sort: FeedSort,
  filter?: PostFilter,
): Promise<PaginatedPostsResult> {
  if (filter?.companyId || filter?.groupId) {
    return fetchFilteredPostsPage(page, pageSize, sort, filter)
  }

  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('posts_with_stats')
    .select(POST_STATS_SELECT, { count: 'exact' })
    .eq('is_deleted', false)

  query =
    sort === 'top'
      ? query.order('engagement_score', { ascending: false, nullsFirst: false })
      : query.order('created_at', { ascending: false })

  const { data, error, count } = await query.range(from, to)

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const mapped = ((data ?? []) as PostRow[]).map((row) => mapPost(row))
  const items = await enrichPosts(mapped)
  const total = count ?? 0

  return {
    items,
    page,
    pageSize,
    hasMore: total ? to + 1 < total : items.length === pageSize,
    error: null,
  }
}

async function fetchFilteredPostsPage(
  page: number,
  pageSize: number,
  sort: FeedSort,
  filter: PostFilter,
): Promise<PaginatedPostsResult> {
  const from = page * pageSize
  const to = from + pageSize - 1

  let idQuery = supabase.from('posts').select('id', { count: 'exact' }).eq('is_deleted', false)

  if (filter.companyId) idQuery = idQuery.eq('company_id', filter.companyId)
  if (filter.groupId) idQuery = idQuery.eq('group_id', filter.groupId)

  idQuery =
    sort === 'top'
      ? idQuery.order('engagement_score', { ascending: false, nullsFirst: false })
      : idQuery.order('created_at', { ascending: false })

  const { data: idRows, error: idError, count } = await idQuery.range(from, to)

  if (idError) {
    return { items: [], page, pageSize, hasMore: false, error: idError.message }
  }

  const ids = (idRows ?? []).map((row) => row.id)
  if (!ids.length) {
    return { items: [], page, pageSize, hasMore: false, error: null }
  }

  const { data, error } = await supabase
    .from('posts_with_stats')
    .select(POST_STATS_SELECT)
    .in('id', ids)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const mapped = ((data ?? []) as PostRow[]).map((row) => mapPost(row))
  const items = await enrichPosts(mapped)
  const total = count ?? 0

  return {
    items,
    page,
    pageSize,
    hasMore: total ? to + 1 < total : items.length === pageSize,
    error: null,
  }
}

export async function fetchCommunityFeedPage(
  page: number,
  pageSize = COMMUNITY_PAGE_SIZE,
  sort: FeedSort = 'recent',
): Promise<PaginatedPostsResult> {
  return fetchPostsPage(page, pageSize, sort)
}

export async function fetchCompanyPostsPage(
  companyId: string,
  page: number,
  pageSize = COMMUNITY_PAGE_SIZE,
): Promise<PaginatedPostsResult> {
  return fetchPostsPage(page, pageSize, 'recent', { companyId })
}

export async function fetchGroupPostsPage(
  groupId: string,
  page: number,
  pageSize = COMMUNITY_PAGE_SIZE,
): Promise<PaginatedPostsResult> {
  return fetchPostsPage(page, pageSize, 'recent', { groupId })
}

export async function fetchHashtagFeedPage(
  tag: string,
  page: number,
  pageSize = COMMUNITY_PAGE_SIZE,
): Promise<PaginatedPostsResult> {
  const normalized = tag.toLowerCase().replace(/^#/, '')
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data: idRows, error: idError, count } = await supabase
    .from('posts')
    .select('id', { count: 'exact' })
    .contains('tags', [normalized])
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (idError) {
    return { items: [], page, pageSize, hasMore: false, error: idError.message }
  }

  const ids = (idRows ?? []).map((row) => row.id)
  if (!ids.length) {
    return { items: [], page, pageSize, hasMore: false, error: null }
  }

  const { data, error } = await supabase
    .from('posts_with_stats')
    .select(POST_STATS_SELECT)
    .in('id', ids)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) {
    return { items: [], page, pageSize, hasMore: false, error: error.message }
  }

  const mapped = ((data ?? []) as PostRow[]).map((row) => mapPost(row))
  const items = await enrichPosts(mapped)
  const total = count ?? 0

  return {
    items,
    page,
    pageSize,
    hasMore: total ? to + 1 < total : items.length === pageSize,
    error: null,
  }
}

export async function createCommunityPost(
  userId: string,
  input: CreatePostInput,
): Promise<{ id: string | null; error: string | null }> {
  const content = input.content.trim()
  const imageUrl = input.imageUrl?.trim() || null
  if (!content && !imageUrl) {
    return { id: null, error: 'Write something or add media before posting.' }
  }

  const tags = extractHashtags(content)
  const mentions = extractMentions(content)
  const isEvent = !!input.eventTitle?.trim()

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content,
      post_data: {},
      visibility: 'public',
      post_type:
        input.postType ??
        (isEvent ? 'event' : imageUrl && /\.gif/i.test(imageUrl) ? 'gif' : 'text'),
      image_url: imageUrl,
      company_id: input.companyId ?? null,
      group_id: input.groupId ?? null,
      published_at: new Date().toISOString(),
      allow_comments: true,
      allow_reactions: true,
      tags: tags.length ? tags : null,
      mentions: mentions.length ? mentions : null,
      event_title: input.eventTitle ?? null,
      event_description: input.eventDescription ?? null,
      event_start_time: input.eventStartTime ?? null,
      event_end_time: input.eventEndTime ?? null,
      event_location: input.eventLocation ?? null,
      event_rsvp_enabled: input.eventRsvpEnabled ?? false,
    })
    .select('id')
    .maybeSingle()

  return { id: data?.id ?? null, error: error?.message ?? null }
}
