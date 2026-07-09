import { supabase } from '~/lib/supabase/client'

import type { ReactionType } from './constants'

export type PostComment = {
  id: string
  postId: string
  userId: string
  content: string
  createdAt: string
  authorName: string
  authorHeadline: string | null
  authorAvatar: string | null
  replyCount: number
  likeCount: number
}

export type PostReaction = {
  userId: string
  userName: string
  userHeadline: string | null
  userAvatar: string | null
  reactionType: string
  createdAt: string
}

export async function fetchUserPostReaction(
  userId: string,
  postId: string,
): Promise<{ id: string; reactionType: string } | null> {
  const { data } = await supabase
    .from('post_reactions')
    .select('id, reaction_type')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle()

  if (!data) return null
  return { id: data.id, reactionType: data.reaction_type }
}

export async function upsertPostReaction(
  userId: string,
  postId: string,
  reactionType: ReactionType,
  existingId?: string | null,
  currentType?: string | null,
): Promise<{ error: string | null; removed?: boolean }> {
  if (existingId) {
    if (currentType === reactionType) {
      const { error } = await supabase.from('post_reactions').delete().eq('id', existingId)
      return { error: error?.message ?? null, removed: true }
    }

    const { error } = await supabase
      .from('post_reactions')
      .update({ reaction_type: reactionType })
      .eq('id', existingId)

    return { error: error?.message ?? null }
  }

  const { error } = await supabase.from('post_reactions').insert({
    user_id: userId,
    post_id: postId,
    reaction_type: reactionType,
  })

  return { error: error?.message ?? null }
}

/** @deprecated Use upsertPostReaction */
export async function setPostReaction(
  userId: string,
  postId: string,
  reactionType: ReactionType,
  existingId?: string | null,
): Promise<{ error: string | null }> {
  const result = await upsertPostReaction(userId, postId, reactionType, existingId, null)
  return { error: result.error }
}

export async function fetchPostReactions(
  postId: string,
): Promise<{ items: PostReaction[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_post_reactions_detailed', {
    post_id_param: postId,
  })

  if (error) {
    return { items: [], error: error.message }
  }

  const items = (data ?? []).map((row) => ({
    userId: row.user_id,
    userName: row.user_name,
    userHeadline: row.user_headline,
    userAvatar: row.user_avatar,
    reactionType: row.reaction_type,
    createdAt: row.created_at,
  }))

  return { items, error: null }
}

export async function fetchPostComments(
  postId: string,
  limit = 50,
): Promise<{ items: PostComment[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_post_comments_threaded', {
    post_id_param: postId,
    limit_param: limit,
    offset_param: 0,
  })

  if (error) {
    return { items: [], error: error.message }
  }

  const items = (data ?? []).map((row) => ({
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
    authorName: row.author_name,
    authorHeadline: row.author_headline,
    authorAvatar: row.author_avatar,
    replyCount: row.reply_count ?? 0,
    likeCount: row.total_likes ?? 0,
  }))

  return { items, error: null }
}

export async function addPostComment(
  userId: string,
  postId: string,
  content: string,
): Promise<{ error: string | null }> {
  const trimmed = content.trim()
  if (!trimmed) return { error: 'Comment cannot be empty.' }

  const { error } = await supabase.from('comments').insert({
    user_id: userId,
    post_id: postId,
    content: trimmed,
  })

  return { error: error?.message ?? null }
}

export async function repostPost(
  userId: string,
  originalPostId: string,
  comment?: string,
): Promise<{ id: string | null; error: string | null }> {
  const trimmedComment = comment?.trim() ?? ''

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content: trimmedComment,
      original_post_id: originalPostId,
      post_type: 'repost',
      post_data: {},
      visibility: 'public',
      published_at: new Date().toISOString(),
      repost_comment: trimmedComment || null,
      allow_comments: true,
      allow_reactions: true,
    })
    .select('id')
    .maybeSingle()

  return { id: data?.id ?? null, error: error?.message ?? null }
}

import { buildAbsoluteUrl } from '~/lib/platform/url'

export function getPostShareUrl(postId: string) {
  return buildAbsoluteUrl(`/community/post/${postId}`)
}
