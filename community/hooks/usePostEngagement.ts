import { useCallback, useEffect, useState } from 'react'

import type { ReactionType } from '~/community/lib/constants'
import { REACTION_TYPES } from '~/community/lib/constants'
import {
  addPostComment,
  fetchPostComments,
  fetchPostReactions,
  fetchUserPostReaction,
  repostPost,
  upsertPostReaction,
  type PostComment,
  type PostReaction,
} from '~/community/lib/post-engagement'
import { useSupabase } from '~/providers/SupabaseProvider'

export type PostSheetType =
  | 'reactions'
  | 'reaction-picker'
  | 'comments'
  | 'repost'
  | 'share'
  | 'options'
  | null

export function usePostEngagement(
  postId: string,
  initialLikeCount: number,
  initialCommentCount: number,
) {
  const { user } = useSupabase()
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [commentCount, setCommentCount] = useState(initialCommentCount)
  const [reactionId, setReactionId] = useState<string | null>(null)
  const [reactionType, setReactionType] = useState<string | null>(null)
  const [reactions, setReactions] = useState<PostReaction[]>([])
  const [comments, setComments] = useState<PostComment[]>([])
  const [activeSheet, setActiveSheet] = useState<PostSheetType>(null)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [isLoadingReactions, setIsLoadingReactions] = useState(false)
  const [isReacting, setIsReacting] = useState(false)
  const [isCommenting, setIsCommenting] = useState(false)
  const [isReposting, setIsReposting] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [repostDraft, setRepostDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLikeCount(initialLikeCount)
    setCommentCount(initialCommentCount)
  }, [initialLikeCount, initialCommentCount, postId])

  useEffect(() => {
    if (!user) {
      setReactionId(null)
      setReactionType(null)
      return
    }

    fetchUserPostReaction(user.id, postId).then((reaction) => {
      setReactionId(reaction?.id ?? null)
      setReactionType(reaction?.reactionType ?? null)
    })
  }, [postId, user])

  const loadComments = useCallback(async () => {
    setIsLoadingComments(true)
    const result = await fetchPostComments(postId)
    setComments(result.items)
    setError(result.error)
    setIsLoadingComments(false)
  }, [postId])

  const loadReactions = useCallback(async () => {
    setIsLoadingReactions(true)
    const result = await fetchPostReactions(postId)
    setReactions(result.items)
    setError(result.error)
    setIsLoadingReactions(false)
  }, [postId])

  const openSheet = useCallback(
    async (sheet: PostSheetType) => {
      setActiveSheet(sheet)
      if (sheet === 'comments' && comments.length === 0) {
        await loadComments()
      }
      if ((sheet === 'reactions' || sheet === 'reaction-picker') && reactions.length === 0) {
        await loadReactions()
      }
    },
    [comments.length, loadComments, loadReactions, reactions.length],
  )

  const closeSheet = useCallback(() => {
    setActiveSheet(null)
  }, [])

  const pickReaction = useCallback(
    async (type: ReactionType) => {
      if (!user) return { error: 'Sign in to react' }

      setIsReacting(true)
      const result = await upsertPostReaction(user.id, postId, type, reactionId, reactionType)
      setIsReacting(false)

      if (!result.error) {
        if (result.removed) {
          setReactionId(null)
          setReactionType(null)
          setLikeCount((count) => Math.max(0, count - 1))
        } else if (reactionId) {
          setReactionType(type)
        } else {
          setReactionType(type)
          setLikeCount((count) => count + 1)
          const reaction = await fetchUserPostReaction(user.id, postId)
          setReactionId(reaction?.id ?? null)
        }
        await loadReactions()
        setActiveSheet(null)
      }

      return result
    },
    [loadReactions, postId, reactionId, reactionType, user],
  )

  const submitComment = useCallback(async () => {
    if (!user) return { error: 'Sign in to comment' }

    setIsCommenting(true)
    const result = await addPostComment(user.id, postId, commentDraft)
    setIsCommenting(false)

    if (!result.error) {
      setCommentDraft('')
      setCommentCount((count) => count + 1)
      await loadComments()
    } else {
      setError(result.error)
    }

    return result
  }, [commentDraft, loadComments, postId, user])

  const submitRepost = useCallback(async () => {
    if (!user) return { error: 'Sign in to repost' }

    setIsReposting(true)
    const result = await repostPost(user.id, postId, repostDraft)
    setIsReposting(false)

    if (!result.error) {
      setRepostDraft('')
      setActiveSheet(null)
    }

    return result
  }, [postId, repostDraft, user])

  const quickLike = useCallback(async () => {
    if (!user) return { error: 'Sign in to react' }
    return pickReaction('like')
  }, [pickReaction, user])

  const reactionLabel =
    REACTION_TYPES.find((item) => item.type === reactionType)?.label ?? 'Like'
  const reactionEmoji =
    REACTION_TYPES.find((item) => item.type === reactionType)?.emoji ?? '👍'

  return {
    user,
    isAuthenticated: !!user,
    likeCount,
    commentCount,
    reactionId,
    reactionType,
    reactionLabel,
    reactionEmoji,
    quickLike,
    isLiked: !!reactionId,
    reactions,
    comments,
    activeSheet,
    isLoadingComments,
    isLoadingReactions,
    isReacting,
    isCommenting,
    isReposting,
    commentDraft,
    repostDraft,
    setCommentDraft,
    setRepostDraft,
    error,
    openSheet,
    closeSheet,
    pickReaction,
    submitComment,
    submitRepost,
    loadComments,
    loadReactions,
  }
}
