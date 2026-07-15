import type { CommunityPost } from '~/community/lib/community'
import { hydrateCommunityPostMedia } from '~/community/lib/community'
import { supabase } from '~/lib/supabase/client'

const FEATURED_SELECT =
  'id, content, image_url, image_urls, media_urls, video_url, video_urls, created_at, post_type, user_id, like_count, total_comments, author_name, author_headline, author_avatar, is_pinned'

function mapFeatured(row: {
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
  is_pinned: boolean | null
}): CommunityPost {
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

/** Featured (pinned) posts on a profile. */
export async function fetchFeaturedPosts(
  userId: string,
  limit = 3,
): Promise<{ items: CommunityPost[]; error: string | null }> {
  const { data, error } = await supabase
    .from('posts_with_stats')
    .select(FEATURED_SELECT)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .eq('is_pinned', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { items: [], error: error.message }
  const items = await hydrateCommunityPostMedia((data ?? []).map(mapFeatured))
  return { items, error: null }
}

export async function setPostFeatured(
  postId: string,
  userId: string,
  featured: boolean,
): Promise<{ error: string | null }> {
  if (featured) {
    const { count } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_pinned', true)
      .eq('is_deleted', false)

    if ((count ?? 0) >= 3) {
      return { error: 'You can feature up to 3 posts. Unpin one first.' }
    }
  }

  const { error } = await supabase
    .from('posts')
    .update({ is_pinned: featured })
    .eq('id', postId)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}
