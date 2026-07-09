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

export async function fetchStoryRings(viewerId: string): Promise<StoryRing[]> {
  const { data: following } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', viewerId)
    .eq('status', 'active')

  const { data: connections } = await supabase.rpc('get_user_connections', {
    target_user_id: viewerId,
    connection_status: 'accepted',
  })

  const networkIds = new Set<string>([viewerId])
  for (const row of following ?? []) networkIds.add(row.following_id)
  for (const row of (connections as { user_id: string }[] | null) ?? []) {
    if (row.user_id) networkIds.add(row.user_id)
  }

  const now = new Date().toISOString()
  const { data: stories } = await supabase
    .from('stories')
    .select('id, user_id')
    .in('user_id', [...networkIds])
    .eq('is_active', true)
    .gt('expires_at', now)

  if (!stories?.length) return []

  const storyUserIds = [...new Set(stories.map((s) => s.user_id))]
  const storyIds = stories.map((s) => s.id)

  const [{ data: profiles }, { data: views }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', storyUserIds)
      .eq('is_deleted', false),
    supabase.from('story_views').select('story_id').eq('viewer_id', viewerId).in('story_id', storyIds),
  ])

  const viewedIds = new Set((views ?? []).map((v) => v.story_id))
  const countByUser = new Map<string, number>()
  const unseenByUser = new Map<string, boolean>()

  for (const story of stories) {
    countByUser.set(story.user_id, (countByUser.get(story.user_id) ?? 0) + 1)
    if (!viewedIds.has(story.id)) unseenByUser.set(story.user_id, true)
  }

  return (profiles ?? [])
    .map((profile) => ({
      user_id: profile.id,
      full_name: profile.full_name ?? profile.username ?? 'Member',
      username: profile.username,
      avatar_url: profile.avatar_url,
      has_unseen: unseenByUser.get(profile.id) ?? false,
      story_count: countByUser.get(profile.id) ?? 0,
    }))
    .filter((ring) => ring.story_count > 0)
    .sort((a, b) => Number(b.has_unseen) - Number(a.has_unseen))
}

export async function fetchUserStories(userId: string): Promise<StorySlide[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('stories')
    .select(
      'id, user_id, content, media_type, media_url, background_color, text_color, created_at, expires_at, view_count',
    )
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('expires_at', now)
    .order('created_at', { ascending: true })

  if (error) return []
  return (data ?? []) as StorySlide[]
}

export async function createStory(
  userId: string,
  input: {
    mediaType: 'text' | 'image'
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

  if (error) {
    return { error: error.message }
  }
  return { error: null }
}
