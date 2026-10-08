import { useCallback, useEffect, useRef, useState } from 'react'

import type { ReactionType } from '~/community/lib/constants'
import { REACTION_TYPES } from '~/community/lib/constants'
import {
  addPostComment,
  deletePostComment as deletePostCommentApi,
  fetchPostComments,
  fetchPostReactions,
  fetchUserPostReaction,
  repostPost,
  toggleCommentLike as toggleCommentLikeApi,
  updatePostComment as updatePostCommentApi,
  upsertPostReaction,
  type PostComment,
  type PostReaction,
} from '~/community/lib/post-engagement'
import { useSupabase } from '~/providers/SupabaseProvider'

export type PostSheetType =
  | 'reactions'
  | 'reaction-picker'
  | 'comments'
  | 'repost-menu'
  | 'repost'
  | 'send'
  | 'share'
  | 'options'
  | 'edit'
  | 'delete-confirm'
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
  // State updates do not disable a button until React renders again. These
  // synchronous locks prevent rapid touch/click events from starting duplicate
  // mutations during that gap on web, iOS, and Android.
  const commentSubmitInFlightRef = useRef(false)
  const replySubmitInFlightRef = useRef(new Set<string>())
  const commentDeleteInFlightRef = useRef(new Set<string>())
  const commentEditInFlightRef = useRef(new Set<string>())

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

    let cancelled = false
    fetchUserPostReaction(user.id, postId).then((reaction) => {
      if (cancelled) return
      setReactionId(reaction?.id ?? null)
      setReactionType(reaction?.reactionType ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [postId, user])

  const loadComments = useCallback(async () => {
    setIsLoadingComments(true)
    const result = await fetchPostComments(postId, 100, user?.id ?? null)
    setComments(result.items)
    setError(result.error)
    setIsLoadingComments(false)
  }, [postId, user])

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

  const submitComment = useCallback(async (encodedOverride?: string) => {
    if (!user) return { error: 'Sign in to comment' }

    const body = (encodedOverride ?? commentDraft).trim()
    if (!body) return { error: 'Comment is empty' }
    if (commentSubmitInFlightRef.current) return { error: null }

    commentSubmitInFlightRef.current = true
    setIsCommenting(true)
    try {
      const result = await addPostComment(user.id, postId, body)

      if (!result.error) {
        setCommentDraft('')
        setCommentCount((count) => count + 1)
        await loadComments()
      } else {
        setError(result.error)
      }

      return result
    } finally {
      commentSubmitInFlightRef.current = false
      setIsCommenting(false)
    }
  }, [commentDraft, loadComments, postId, user])

  const replyToComment = useCallback(
    async (parentCommentId: string, body: string) => {
      if (!user) return { error: 'Sign in to reply' }
      const trimmed = body.trim()
      if (!trimmed) return { error: 'Reply is empty' }
      if (replySubmitInFlightRef.current.has(parentCommentId)) return { error: null }

      replySubmitInFlightRef.current.add(parentCommentId)
      try {
        const result = await addPostComment(user.id, postId, trimmed, parentCommentId)
        if (!result.error) {
          setCommentCount((count) => count + 1)
          await loadComments()
        } else {
          setError(result.error)
        }
        return result
      } finally {
        replySubmitInFlightRef.current.delete(parentCommentId)
      }
    },
    [loadComments, postId, user],
  )

  const toggleCommentLike = useCallback(
    async (commentId: string, type: ReactionType = 'like') => {
      if (!user) return { error: 'Sign in to like' }

      const target = comments.find((comment) => comment.id === commentId)
      if (!target) return { error: 'Comment not found' }
      const wasLiked = target.likedByMe
      const previousType = target.myReactionType
      const removing = wasLiked && previousType === type

      // Optimistic update.
      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId
            ? applyCommentReactionChange(comment, type, removing)
            : comment,
        ),
      )

      const result = await toggleCommentLikeApi(user.id, commentId, wasLiked, type, previousType)
      if (result.error) {
        // Revert on failure.
        setComments((current) =>
          current.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  likedByMe: wasLiked,
                  myReactionType: previousType,
                  reactionCounts: target.reactionCounts,
                  likeCount: target.likeCount,
                }
              : comment,
          ),
        )
      }
      return result
    },
    [comments, user],
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!user) return { error: 'Sign in to delete this comment' }
      if (commentDeleteInFlightRef.current.has(commentId)) return { error: null }

      // Comment authors and post authors may both delete; RLS is the real gate,
      // so this only checks the comment is still on screen.
      const target = comments.find((comment) => comment.id === commentId)
      if (!target) return { error: 'Comment not found' }

      commentDeleteInFlightRef.current.add(commentId)
      try {
        const result = await deletePostCommentApi(commentId)
        if (result.error) {
          setError(result.error)
          return result
        }

        const removedIds = new Set([commentId])
        let changed = true
        while (changed) {
          changed = false
          for (const comment of comments) {
            if (
              comment.parentCommentId &&
              removedIds.has(comment.parentCommentId) &&
              !removedIds.has(comment.id)
            ) {
              removedIds.add(comment.id)
              changed = true
            }
          }
        }
        setComments((current) => current.filter((comment) => !removedIds.has(comment.id)))
        setCommentCount((count) => Math.max(0, count - removedIds.size))
        return result
      } finally {
        commentDeleteInFlightRef.current.delete(commentId)
      }
    },
    [comments, user],
  )

  const editComment = useCallback(
    async (commentId: string, content: string) => {
      if (!user) return { error: 'Sign in to edit this comment' }
      const trimmed = content.trim()
      if (!trimmed) return { error: 'Comment cannot be empty.' }
      if (commentEditInFlightRef.current.has(commentId)) return { error: null }

      const target = comments.find((comment) => comment.id === commentId)
      if (!target || target.userId !== user.id) {
        return { error: 'You can only edit your own comments.' }
      }

      commentEditInFlightRef.current.add(commentId)
      try {
        const result = await updatePostCommentApi(user.id, commentId, trimmed)
        if (result.error) {
          setError(result.error)
          return result
        }
        setComments((current) =>
          current.map((comment) =>
            comment.id === commentId ? { ...comment, content: trimmed } : comment,
          ),
        )
        return result
      } finally {
        commentEditInFlightRef.current.delete(commentId)
      }
    },
    [comments, user],
  )

  const submitRepost = useCallback(async (encodedOverride?: string) => {
    if (!user) return { error: 'Sign in to repost' }

    setIsReposting(true)
    const result = await repostPost(user.id, postId, encodedOverride ?? repostDraft)
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
    replyToComment,
    toggleCommentLike,
    editComment,
    deleteComment,
    submitRepost,
    loadComments,
    loadReactions,
  }
}

function applyCommentReactionChange(
  comment: PostComment,
  nextType: ReactionType,
  removing: boolean,
): PostComment {
  const counts = { ...comment.reactionCounts }
  const previousType = comment.myReactionType

  if (previousType) {
    const nextCount = Math.max(0, (counts[previousType] ?? 0) - 1)
    if (nextCount > 0) counts[previousType] = nextCount
    else delete counts[previousType]
  }

  if (!removing) {
    counts[nextType] = (counts[nextType] ?? 0) + 1
  }

  return {
    ...comment,
    likedByMe: !removing,
    myReactionType: removing ? null : nextType,
    reactionCounts: counts,
    likeCount: Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0),
  }
}
