import { createDirectConversation, sendMessage } from '~/chat/lib/chats'
import { refreshStories } from '~/community/lib/story-refresh'
import { STORAGE_BUCKETS } from '~/lib/supabase/storage-upload'
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
  user_viewed?: boolean
}

export type StoryViewer = {
  viewer_id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  viewed_at: string | null
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
export async function fetchStoryRings(viewerId?: string): Promise<StoryRing[]> {
  const { data, error } = await supabase.rpc('get_story_feed')
  if (error || !data?.length) return []

  const rows = data as StoryFeedRow[]
  const byUser = new Map<string, StoryRing>()

  for (const row of rows) {
    const existing = byUser.get(row.user_id)
    // Own stories never show as "unseen" for the author (WhatsApp-style).
    const unseen =
      viewerId && row.user_id === viewerId ? false : !(row.user_viewed ?? false)
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
      user_viewed: row.user_viewed ?? false,
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

  return ((legacy ?? []) as StorySlide[]).map((row) => ({ ...row, user_viewed: false }))
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

  if (!error && data?.id) refreshStories()

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

  // Ring colors update immediately after watching.
  refreshStories()
  return { error: null }
}

export async function deleteStory(
  storyId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('stories')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', storyId)
    .eq('user_id', userId)

  if (!error) refreshStories()
  return { error: error?.message ?? null }
}

export async function fetchStoryViewers(storyId: string): Promise<{
  items: StoryViewer[]
  error: string | null
}> {
  const { data, error } = await supabase.rpc('get_story_viewers', {
    p_story_id: storyId,
  })
  if (error) return { items: [], error: error.message }
  return {
    items: ((data ?? []) as StoryViewer[]).map((row) => ({
      viewer_id: row.viewer_id,
      full_name: row.full_name,
      username: row.username,
      avatar_url: row.avatar_url,
      viewed_at: row.viewed_at,
    })),
    error: null,
  }
}

/** Reply to a story with a DM that references the story (WhatsApp-style). */
export async function replyToStory(input: {
  authorId: string
  senderId: string
  storyId: string
  text: string
  previewUrl?: string | null
  previewText?: string | null
}): Promise<{ conversationId: string | null; error: string | null }> {
  const content = input.text.trim()
  if (!content) return { conversationId: null, error: 'Write a reply first.' }

  const { conversationId, error: convoError } = await createDirectConversation(input.authorId)
  if (convoError || !conversationId) {
    return { conversationId: null, error: convoError ?? 'Could not open chat.' }
  }

  const { error: sendError } = await sendMessage({
    conversationId,
    senderId: input.senderId,
    content,
    type: 'text',
    metadata: {
      type: 'story_reply',
      storyId: input.storyId,
      authorId: input.authorId,
      previewUrl: input.previewUrl ?? null,
      previewText: input.previewText ?? null,
    },
  })

  if (sendError) return { conversationId, error: sendError }
  return { conversationId, error: null }
}

/** Best-effort delete of a public post-images object after a failed story insert. */
export async function deleteStoryMediaUrl(publicUrl: string | undefined | null): Promise<void> {
  if (!publicUrl) return
  const marker = `/object/public/${STORAGE_BUCKETS.postImages}/`
  const idx = publicUrl.indexOf(marker)
  if (idx < 0) return
  const path = decodeURIComponent(publicUrl.slice(idx + marker.length))
  if (!path) return
  try {
    await supabase.storage.from(STORAGE_BUCKETS.postImages).remove([path])
  } catch {
    // Best-effort cleanup.
  }
}
