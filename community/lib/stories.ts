import { supabase } from '~/lib/supabase/client'

const STORY_TTL_HOURS = 24

export type StoryRing = {
  user_id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  has_unseen: boolean
  story_count: number
}

export type StorySlide = {
  id: string
  user_id: string
  content: string | null
  media_type: string | null
  media_url: string | null
  background_color: string | null
  text_color: string | null
  created_at: string | null
  expires_at: string | null
  view_count: number | null
}

type StoryFeedRow = {
  id: string
  user_id: string
  user_name: string | null
  user_avatar: string | null
  user_username: string | null
  content: string | null
  media_url: string | null
  media_type: string | null
  background_color: string | null
  text_color: string | null
  view_count: number | null
  user_viewed: boolean | null
  created_at: string | null
  expires_at: string | null
}

type UserStoryRow = {
  id: string
  user_id: string
  content: string | null
  media_url: string | null
  media_type: string | null
  background_color: string | null
  text_color: string | null
  view_count: number | null
  user_viewed: boolean | null
  created_at: string | null
  expires_at: string | null
}

/** Aggregate active stories into Instagram-style rings (own + network). */
export async function fetchStoryRings(_viewerId?: string): Promise<StoryRing[]> {
  const { data, error } = await supabase.rpc('get_story_feed')
  if (error || !data?.length) return []

  const rows = data as StoryFeedRow[]
  const byUser = new Map<string, StoryRing>()

  for (const row of rows) {
    const existing = byUser.get(row.user_id)
    const unseen = !(row.user_viewed ?? false)
    if (!existing) {
      byUser.set(row.user_id, {
        user_id: row.user_id,
        full_name: row.user_name?.trim() || row.user_username || 'Member',
        username: row.user_username,
        avatar_url: row.user_avatar,
        has_unseen: unseen,
        story_count: 1,
      })
      continue
    }
    existing.story_count += 1
    if (unseen) existing.has_unseen = true
  }

  return [...byUser.values()].sort((a, b) => Number(b.has_unseen) - Number(a.has_unseen))
}

export async function fetchUserStories(userId: string): Promise<StorySlide[]> {
  const { data, error } = await supabase.rpc('get_user_stories_with_views', {
    target_user_id: userId,
  })

  if (!error && data) {
    return (data as UserStoryRow[]).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      content: row.content,
      media_type: row.media_type,
      media_url: row.media_url,
      background_color: row.background_color,
      text_color: row.text_color,
      created_at: row.created_at,
      expires_at: row.expires_at,
      view_count: row.view_count,
    }))
  }

  // Fallback for older backends without the RPC.
  const now = new Date().toISOString()
  const { data: legacy } = await supabase
    .from('stories')
    .select(
      'id, user_id, content, media_type, media_url, background_color, text_color, created_at, expires_at, view_count',
    )
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('expires_at', now)
    .order('created_at', { ascending: true })

  return (legacy ?? []) as StorySlide[]
}

export async function createStory(
  userId: string,
  input: {
    mediaType: 'text' | 'image' | 'video'
    content?: string
    mediaUrl?: string
    backgroundColor?: string
    textColor?: string
  },
): Promise<{ id: string | null; error: string | null }> {
  const expiresAt = new Date(Date.now() + STORY_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('stories')
    .insert({
      user_id: userId,
      media_type: input.mediaType,
      content: input.content ?? null,
      media_url: input.mediaUrl ?? null,
      background_color: input.backgroundColor ?? '#0a66c2',
      text_color: input.textColor ?? '#ffffff',
      is_active: true,
      expires_at: expiresAt,
      // Visible to connections/followers via get_story_feed RLS/RPC.
      privacy_level: 'connections',
    })
    .select('id')
    .maybeSingle()

  return { id: data?.id ?? null, error: error?.message ?? null }
}

export async function markStoryViewed(
  storyId: string,
  viewerId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('story_views').insert({
    story_id: storyId,
    viewer_id: viewerId,
    viewed_at: new Date().toISOString(),
  })

  // Unique / already-viewed is fine — treat as success.
  if (error && !/duplicate|unique/i.test(error.message)) {
    return { error: error.message }
  }
  return { error: null }
}
