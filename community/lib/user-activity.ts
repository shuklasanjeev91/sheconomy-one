import type { CommunityPost } from '~/community/lib/community'
import { hydrateCommunityPostMedia } from '~/community/lib/community'
import { supabase } from '~/lib/supabase/client'

export const ACTIVITY_PAGE_SIZE = 10

export type ActivityFilter = 'posts' | 'comments' | 'reactions'

const POST_SELECT =
  'id, content, image_url, image_urls, media_urls, video_url, video_urls, created_at, post_type, user_id, like_count, total_comments, author_name, author_headline, author_avatar, is_pinned'

type PostRow = {
  id: string
  content: string | null
  image_url: string | null
  image_urls?: string[] | null
  media_urls: string[] | null
  video_url?: string | null
  video_urls?: string[] | null
  created_at: string | null
  post_type: string | null
  user_id: string | null
  like_count: number | null
  total_comments: number | null
  author_name: string | null
  author_headline: string | null
  author_avatar: string | null
  is_pinned?: boolean | null
}

function mapPost(row: PostRow): CommunityPost {
  return {
    id: row.id,
    content: row.content ?? '',
    image_url: row.image_url,
    image_urls: row.image_urls?.length ? row.image_urls : null,
    media_url: null,
    media_urls: row.media_urls,
    video_url: row.video_url ?? null,
    video_urls: row.video_urls?.length ? row.video_urls : null,
    created_at: row.created_at,
    post_type: row.post_type,
    user_id: row.user_id,
    company_id: null,
    group_id: null,
    like_count: row.like_count,
    comment_count: row.total_comments,
    engagement_score: null,
    total_reactions: row.like_count,
    author_verified: null,
    author: {
      full_name: row.author_name,
      username: null,
      avatar_url: row.author_avatar,
      headline: row.author_headline,
    },
    company: null,
    group: null,
    event_title: null,
    event_description: null,
    event_start_time: null,
    event_end_time: null,
    event_location: null,
    event_rsvp_enabled: null,
    poll: null,
    listing_id: null,
    celebration: null,
    product: null,
    shop: null,
    link: null,
    article_title: null,
    original_post_id: null,
    repost_comment: null,
    originalPost: null,
    is_pinned: !!row.is_pinned,
  }
}

export type ActivityPage<T> = {
  items: T[]
  hasMore: boolean
  error: string | null
}

export type ActivityComment = {
  id: string
  content: string
  createdAt: string | null
  post: CommunityPost | null
}

export type ActivityReaction = {
  id: string
  reactionType: string
  createdAt: string | null
  post: CommunityPost | null
}

/** Fetch the referenced posts for a set of ids, keyed by id. */
async function fetchPostsByIds(postIds: string[]): Promise<Map<string, CommunityPost>> {
  const map = new Map<string, CommunityPost>()
  const unique = Array.from(new Set(postIds)).filter(Boolean)
  if (unique.length === 0) return map

  const { data } = await supabase
    .from('posts_with_stats')
    .select(POST_SELECT)
    .in('id', unique)
    .eq('is_deleted', false)

  for (const row of (data ?? []) as PostRow[]) {
    map.set(row.id, mapPost(row))
  }
  const posts = [...map.values()]
  const hydrated = await hydrateCommunityPostMedia(posts)
  const hydratedMap = new Map(hydrated.map((post) => [post.id, post]))
  for (const [id, post] of hydratedMap) {
    map.set(id, post)
  }
  return map
}

export async function fetchUserPosts(
  userId: string,
  offset: number,
  limit = ACTIVITY_PAGE_SIZE,
): Promise<ActivityPage<CommunityPost>> {
  const { data, error } = await supabase
    .from('posts_with_stats')
    .select(POST_SELECT)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { items: [], hasMore: false, error: error.message }

  const rows = (data ?? []) as PostRow[]
  const items = await hydrateCommunityPostMedia(rows.map(mapPost))
  return { items, hasMore: rows.length === limit, error: null }
}

export async function fetchUserComments(
  userId: string,
  offset: number,
  limit = ACTIVITY_PAGE_SIZE,
): Promise<ActivityPage<ActivityComment>> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, content, created_at')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { items: [], hasMore: false, error: error.message }

  const rows = (data ?? []) as { id: string; post_id: string; content: string | null; created_at: string | null }[]
  const postsById = await fetchPostsByIds(rows.map((row) => row.post_id))

  const items: ActivityComment[] = rows.map((row) => ({
    id: row.id,
    content: row.content ?? '',
    createdAt: row.created_at,
    post: postsById.get(row.post_id) ?? null,
  }))

  return { items, hasMore: rows.length === limit, error: null }
}

export async function fetchUserReactions(
  userId: string,
  offset: number,
  limit = ACTIVITY_PAGE_SIZE,
): Promise<ActivityPage<ActivityReaction>> {
  const { data, error } = await supabase
    .from('post_reactions')
    .select('id, post_id, reaction_type, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { items: [], hasMore: false, error: error.message }

  const rows = (data ?? []) as { id: string; post_id: string; reaction_type: string | null; created_at: string | null }[]
  const postsById = await fetchPostsByIds(rows.map((row) => row.post_id))

  const items: ActivityReaction[] = rows.map((row) => ({
    id: row.id,
    reactionType: row.reaction_type ?? 'like',
    createdAt: row.created_at,
    post: postsById.get(row.post_id) ?? null,
  }))

  return { items, hasMore: rows.length === limit, error: null }
}
