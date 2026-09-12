import { supabase } from '~/lib/supabase/client'

import type { ReactionType } from '~/community/lib/constants'
import { extractMentions } from '~/community/lib/post-text'

export type PostComment = {
  id: string
  postId: string
  userId: string
  parentCommentId: string | null
  threadLevel: number
  content: string
  createdAt: string
  authorName: string
  authorHeadline: string | null
  authorAvatar: string | null
  replyCount: number
  likeCount: number
  likedByMe: boolean
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
  limit = 100,
  currentUserId?: string | null,
): Promise<{ items: PostComment[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_post_comments_threaded', {
    post_id_param: postId,
    limit_param: limit,
    offset_param: 0,
  })

  if (error) {
    return { items: [], error: error.message }
  }

  const items: PostComment[] = (data ?? []).map((row) => ({
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    parentCommentId: row.parent_comment_id ?? null,
    threadLevel: row.thread_level ?? 0,
    content: row.content,
    createdAt: row.created_at,
    authorName: row.author_name,
    authorHeadline: row.author_headline,
    authorAvatar: row.author_avatar,
    replyCount: row.reply_count ?? 0,
    likeCount: row.total_likes ?? 0,
    likedByMe: false,
  }))

  // Hydrate which comments the signed-in viewer has liked.
  if (currentUserId && items.length) {
    const { data: likes } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .eq('user_id', currentUserId)
      .in(
        'comment_id',
        items.map((item) => item.id),
      )
    const likedIds = new Set((likes ?? []).map((row) => row.comment_id))
    for (const item of items) item.likedByMe = likedIds.has(item.id)
  }

  return { items, error: null }
}

export async function addPostComment(
  userId: string,
  postId: string,
  content: string,
  parentCommentId?: string | null,
): Promise<{ error: string | null }> {
  const trimmed = content.trim()
  if (!trimmed) return { error: 'Comment cannot be empty.' }

  const mentions = extractMentions(trimmed)

  const { error } = await supabase.from('comments').insert({
    user_id: userId,
    post_id: postId,
    content: trimmed,
    parent_comment_id: parentCommentId ?? null,
    mentions: mentions.length ? mentions : null,
  })

  return { error: error?.message ?? null }
}

/** Delete one of the signed-in user's comments. Replies cascade in Postgres. */
export async function deletePostComment(
  userId: string,
  commentId: string,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Comment not found or you cannot delete it.' }
  return { error: null }
}

/** Toggle the signed-in user's like on a comment. */
export async function toggleCommentLike(
  userId: string,
  commentId: string,
  liked: boolean,
): Promise<{ error: string | null }> {
  if (liked) {
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('user_id', userId)
      .eq('comment_id', commentId)
    return { error: error?.message ?? null }
  }

  const { error } = await supabase
    .from('comment_likes')
    .insert({ user_id: userId, comment_id: commentId })
  return { error: error?.message ?? null }
}

export async function hasUserReposted(
  userId: string,
  postId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('reposts')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .limit(1)
    .maybeSingle()
  return !!data?.id
}

export async function recordRepostTracking(
  userId: string,
  postId: string,
  comment?: string,
): Promise<void> {
  await supabase.from('reposts').insert({
    user_id: userId,
    post_id: postId,
    comment: comment?.trim() || null,
  })
}

export async function repostPost(
  userId: string,
  originalPostId: string,
  comment?: string,
): Promise<{ id: string | null; error: string | null }> {
  const trimmedComment = comment?.trim() ?? ''

  const already = await hasUserReposted(userId, originalPostId)
  if (already) {
    return { id: null, error: 'You already reposted this post' }
  }

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

  if (error) return { id: null, error: error.message }

  void recordRepostTracking(userId, originalPostId, trimmedComment)

  return { id: data?.id ?? null, error: null }
}

export { getPostShareUrl } from '~/lib/share/urls'
