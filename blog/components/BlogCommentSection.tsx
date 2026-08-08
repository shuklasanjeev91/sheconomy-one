import { useEffect, useMemo, useState } from 'react'

import {
  Avatar,
  Button,
  Icons,
  Spinner,
  Text,
  TextArea,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAuth } from '~/hooks/useAuth'
import {
  createComment,
  loadComments,
  softDeleteComment,
  type CmsCommentWithAuthor,
} from '~/lib/cms'
import { blogRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import { getTimeAgo } from '~/blog/lib/blog-utils'

export function BlogCommentSection({
  contentId,
  slug,
  commentCount = 0,
}: {
  contentId: string
  slug: string
  commentCount?: number
}) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isAuthenticated, signIn, user } = useAuth()
  const { comments, commentMeta, isFetching, isCreating } = useAppSelector((s) => s.cms)

  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [page, setPage] = useState(1)
  const [pendingNotice, setPendingNotice] = useState(false)

  useEffect(() => {
    void dispatch(
      loadComments({
        content_id: contentId,
        is_approved: true,
        page,
        limit: 20,
      }),
    )
  }, [contentId, dispatch, page])

  const topLevel = useMemo(() => comments.filter((c) => !c.parent_id && !c.deleted_at), [comments])
  const repliesByParent = useMemo(() => {
    const map = new Map<string, CmsCommentWithAuthor[]>()
    for (const c of comments) {
      if (!c.parent_id || c.deleted_at) continue
      const list = map.get(c.parent_id) ?? []
      list.push(c)
      map.set(c.parent_id, list)
    }
    return map
  }, [comments])

  async function postComment() {
    if (!isAuthenticated) {
      signIn(blogRoutes.post(slug))
      return
    }
    const text = body.trim()
    if (!text) return
    try {
      await dispatch(createComment({ content_id: contentId, body: text })).unwrap()
      setBody('')
      setPendingNotice(true)
      toast.show('Comment submitted for review', { tone: 'success' })
      setPage(1)
      void dispatch(
        loadComments({ content_id: contentId, is_approved: true, page: 1, limit: 20 }),
      )
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Could not post comment', { tone: 'danger' })
    }
  }

  async function postReply() {
    if (!replyTo || !isAuthenticated) return
    const text = replyBody.trim()
    if (!text) return
    try {
      await dispatch(
        createComment({
          content_id: contentId,
          parent_id: replyTo.id,
          body: text,
        }),
      ).unwrap()
      setReplyBody('')
      setReplyTo(null)
      toast.show('Reply submitted for review', { tone: 'success' })
      void dispatch(
        loadComments({ content_id: contentId, is_approved: true, page, limit: 20 }),
      )
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Could not post reply', { tone: 'danger' })
    }
  }

  async function removeComment(id: string) {
    try {
      await dispatch(softDeleteComment(id)).unwrap()
      toast.show('Comment deleted', { tone: 'success' })
      void dispatch(
        loadComments({ content_id: contentId, is_approved: true, page, limit: 20 }),
      )
    } catch {
      toast.show('Could not delete comment', { tone: 'danger' })
    }
  }

  return (
    <YStack gap="$4">
      <XStack alignItems="center" gap="$2">
        <Icons.MessageSquare size={20} color={ui.brand} />
        <Text fontSize={20} fontWeight="800" color={ui.text}>
          Comments ({commentCount || topLevel.length})
        </Text>
      </XStack>

      <YStack
        gap="$3"
        padding="$3.5"
        borderRadius={radius.card}
        backgroundColor={ui.surfaceMuted}
        borderWidth={1}
        borderColor={ui.borderSubtle}
      >
        {isAuthenticated ? (
          <>
            <TextArea
              value={body}
              onChangeText={setBody}
              placeholder="Share your thoughts…"
              minHeight={100}
              backgroundColor={ui.surface}
            />
            <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
              {pendingNotice ? (
                <Text fontSize={13} color={ui.textSecondary} flex={1}>
                  Thanks — your comment will appear after review.
                </Text>
              ) : (
                <YStack flex={1} />
              )}
              <Button
                size="$3"
                icon={Icons.Send}
                disabled={isCreating || !body.trim()}
                onPress={() => void postComment()}
              >
                {isCreating ? 'Posting…' : 'Post comment'}
              </Button>
            </XStack>
          </>
        ) : (
          <YStack alignItems="center" gap="$2" paddingVertical="$2">
            <Text color={ui.textMuted} textAlign="center">
              Sign in to leave a comment.
            </Text>
            <Button size="$3" onPress={() => signIn(blogRoutes.post(slug))}>
              Sign in to comment
            </Button>
          </YStack>
        )}
      </YStack>

      {isFetching && topLevel.length === 0 ? (
        <YStack alignItems="center" padding="$4">
          <Spinner />
        </YStack>
      ) : topLevel.length === 0 ? (
        <Text color={ui.textMuted} textAlign="center" paddingVertical="$4">
          No comments yet. Be the first to share your thoughts!
        </Text>
      ) : (
        <YStack gap="$4">
          {topLevel.map((comment) => {
            const author = comment.author
            const name = author?.full_name || author?.username || 'Member'
            const replies = repliesByParent.get(comment.id) ?? []
            const isOwner = !!user?.id && comment.author_id === user.id
            return (
              <YStack key={comment.id} gap="$3">
                <XStack gap="$3" alignItems="flex-start">
                  <Avatar name={name} src={author?.avatar_url} size={36} />
                  <YStack flex={1} minWidth={0} gap="$1.5">
                    <XStack gap="$2" flexWrap="wrap" alignItems="center">
                      <Text fontSize={14} fontWeight="700" color={ui.text}>
                        {name}
                      </Text>
                      <Text fontSize={12} color={ui.textMuted}>
                        {getTimeAgo(comment.created_at)}
                      </Text>
                    </XStack>
                    <Text fontSize={14} color={ui.text} lineHeight={21}>
                      {comment.body}
                    </Text>
                    <XStack gap="$3">
                      {isAuthenticated ? (
                        <Text
                          fontSize={12}
                          fontWeight="600"
                          color={ui.textMuted}
                          cursor="pointer"
                          onPress={() => setReplyTo({ id: comment.id, authorName: name })}
                        >
                          Reply
                        </Text>
                      ) : null}
                      {isOwner ? (
                        <Text
                          fontSize={12}
                          fontWeight="600"
                          color={ui.error}
                          cursor="pointer"
                          onPress={() => void removeComment(comment.id)}
                        >
                          Delete
                        </Text>
                      ) : null}
                    </XStack>
                  </YStack>
                </XStack>

                {replyTo?.id === comment.id ? (
                  <YStack
                    marginLeft="$8"
                    gap="$2"
                    padding="$3"
                    borderRadius={radius.chip}
                    backgroundColor={ui.surfaceMuted}
                  >
                    <Text fontSize={12} color={ui.textMuted}>
                      Replying to {replyTo.authorName}
                    </Text>
                    <TextArea
                      value={replyBody}
                      onChangeText={setReplyBody}
                      placeholder="Write your reply…"
                      minHeight={72}
                      backgroundColor={ui.surface}
                    />
                    <XStack gap="$2" justifyContent="flex-end">
                      <Button
                        size="$2"
                        tone="ghost"
                        onPress={() => {
                          setReplyTo(null)
                          setReplyBody('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="$2"
                        disabled={isCreating || !replyBody.trim()}
                        onPress={() => void postReply()}
                      >
                        Reply
                      </Button>
                    </XStack>
                  </YStack>
                ) : null}

                {replies.length ? (
                  <YStack
                    marginLeft="$6"
                    gap="$3"
                    paddingLeft="$3"
                    borderLeftWidth={2}
                    borderLeftColor={ui.roseSurface}
                  >
                    {replies.map((reply) => {
                      const rAuthor = reply.author
                      const rName = rAuthor?.full_name || rAuthor?.username || 'Member'
                      const rOwner = !!user?.id && reply.author_id === user.id
                      return (
                        <XStack key={reply.id} gap="$2.5" alignItems="flex-start">
                          <Avatar name={rName} src={rAuthor?.avatar_url} size={28} />
                          <YStack flex={1} gap="$1">
                            <XStack gap="$2" flexWrap="wrap">
                              <Text fontSize={13} fontWeight="700" color={ui.text}>
                                {rName}
                              </Text>
                              <Text fontSize={11} color={ui.textMuted}>
                                {getTimeAgo(reply.created_at)}
                              </Text>
                            </XStack>
                            <Text fontSize={13} color={ui.text} lineHeight={20}>
                              {reply.body}
                            </Text>
                            {rOwner ? (
                              <Text
                                fontSize={11}
                                color={ui.error}
                                cursor="pointer"
                                onPress={() => void removeComment(reply.id)}
                              >
                                Delete
                              </Text>
                            ) : null}
                          </YStack>
                        </XStack>
                      )
                    })}
                  </YStack>
                ) : null}
              </YStack>
            )
          })}
        </YStack>
      )}

      {commentMeta?.hasNextPage ? (
        <Button
          alignSelf="center"
          size="$3"
          tone="outline"
          disabled={isFetching}
          onPress={() => setPage((p) => p + 1)}
        >
          Load more comments
        </Button>
      ) : null}
    </YStack>
  )
}
