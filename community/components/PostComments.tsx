import { useMemo, useRef, useState } from 'react'
import { Alert, Platform } from 'react-native'

import { CommentSuggestionChips } from '~/community/components/CommentSuggestionChips'
import { MentionInput } from '~/community/components/MentionInput'
import { ProfileLink } from '~/community/components/ProfileLink'
import { PostContentText } from '~/community/components/PostContentText'
import type { CommentSuggestionContext } from '~/community/lib/comment-suggestions'
import type { PostComment } from '~/community/lib/post-engagement'
import { BRAND_BLUE } from '~/community/lib/constants'
import {
  Avatar,
  Button,
  Icons,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

function formatCommentTime(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 60) return `${Math.max(minutes, 1)}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

type PostCommentsProps = {
  comments: PostComment[]
  isLoading: boolean
  isAuthenticated: boolean
  currentUserId: string | null
  commentDraft: string
  isCommenting: boolean
  onDraftChange: (value: string) => void
  onSubmit: (encoded?: string) => void
  onLikeComment: (commentId: string) => void
  onDeleteComment: (commentId: string) => Promise<{ error?: string | null } | unknown>
  onReply: (parentCommentId: string, encoded: string) => Promise<unknown> | void
  /** When set, show AI/local comment starters. */
  suggestionContext?: CommentSuggestionContext
}

export function PostComments({
  comments,
  isLoading,
  isAuthenticated,
  currentUserId,
  commentDraft,
  isCommenting,
  onDraftChange,
  onSubmit,
  onLikeComment,
  onDeleteComment,
  onReply,
  suggestionContext,
}: PostCommentsProps) {
  const ui = useAppUi()
  const encodedRef = useRef('')

  const { topLevel, repliesByParent } = useMemo(() => {
    const top: PostComment[] = []
    const byParent = new Map<string, PostComment[]>()
    for (const comment of comments) {
      if (comment.parentCommentId) {
        const list = byParent.get(comment.parentCommentId) ?? []
        list.push(comment)
        byParent.set(comment.parentCommentId, list)
      } else {
        top.push(comment)
      }
    }
    return { topLevel: top, repliesByParent: byParent }
  }, [comments])

  return (
    <YStack
      paddingHorizontal="$3"
      paddingBottom="$3"
      gap="$3"
      borderTopWidth={1}
      borderTopColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
    >
      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$3">
          <Spinner size="small" />
        </YStack>
      ) : topLevel.length === 0 ? (
        <Text fontSize={13} color={ui.textMuted} textAlign="center" paddingVertical="$3">
          No comments yet. Start the conversation.
        </Text>
      ) : (
        <YStack gap="$3">
          {topLevel.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              replies={repliesByParent.get(comment.id) ?? []}
              isAuthenticated={isAuthenticated}
              currentUserId={currentUserId}
              onLikeComment={onLikeComment}
              onDeleteComment={onDeleteComment}
              onReply={onReply}
            />
          ))}
        </YStack>
      )}

      {isAuthenticated ? (
        <YStack gap="$2">
          {suggestionContext ? (
            <CommentSuggestionChips
              context={suggestionContext}
              disabled={isCommenting}
              onSelect={(text) => {
                // MentionInput's encoded value is held separately. Keep it in
                // sync when a suggestion replaces the visible controlled value.
                encodedRef.current = text
                onDraftChange(text)
              }}
            />
          ) : null}
          <XStack gap="$2" alignItems="center">
            <MentionInput
              flex={1}
              value={commentDraft}
              onChangeText={(text) => {
                encodedRef.current = text
                onDraftChange(text)
              }}
              onEncodedChange={(encoded) => {
                encodedRef.current = encoded
              }}
              placeholder="Add a comment…"
              suggestionsPlacement="top"
              borderRadius={999}
              backgroundColor={ui.surface}
              onSubmitEditing={() => onSubmit(encodedRef.current || commentDraft)}
            />
            <Button
              size="$3"
              backgroundColor={commentDraft.trim() ? BRAND_BLUE : ui.chip}
              color={commentDraft.trim() ? 'white' : ui.textMuted}
              borderRadius={999}
              disabled={!commentDraft.trim() || isCommenting}
              onPress={() => onSubmit(encodedRef.current || commentDraft)}
              icon={isCommenting ? <Spinner size="small" color="white" /> : <Icons.Send size={16} color="white" />}
            />
          </XStack>
        </YStack>
      ) : (
        <Text fontSize={13} color={ui.textMuted} textAlign="center">
          Sign in to join the conversation
        </Text>
      )}
    </YStack>
  )
}

function CommentThread({
  comment,
  replies,
  isAuthenticated,
  currentUserId,
  onLikeComment,
  onDeleteComment,
  onReply,
}: {
  comment: PostComment
  replies: PostComment[]
  isAuthenticated: boolean
  currentUserId: string | null
  onLikeComment: (commentId: string) => void
  onDeleteComment: (commentId: string) => Promise<{ error?: string | null } | unknown>
  onReply: (parentCommentId: string, encoded: string) => Promise<unknown> | void
}) {
  const ui = useAppUi()
  const [showReplies, setShowReplies] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const replyEncodedRef = useRef('')

  function openReply(mentionName?: string) {
    if (!isAuthenticated) {
      // Let the parent surface the auth prompt via the like/reply handlers.
      onReply(comment.id, '')
      return
    }
    const seed = mentionName ? `@${mentionName} ` : ''
    setReplyDraft(seed)
    replyEncodedRef.current = seed
    setReplyOpen(true)
    setShowReplies(true)
  }

  async function submitReply() {
    const body = (replyEncodedRef.current || replyDraft).trim()
    if (!body) return
    setIsSending(true)
    await onReply(comment.id, body)
    setIsSending(false)
    setReplyDraft('')
    replyEncodedRef.current = ''
    setReplyOpen(false)
  }

  return (
    <YStack gap="$2">
      <CommentRow
        comment={comment}
        canDelete={comment.userId === currentUserId}
        onLike={() => onLikeComment(comment.id)}
        onDelete={() => onDeleteComment(comment.id)}
        onReply={() => openReply()}
      />

      {replies.length > 0 ? (
        <YStack paddingLeft={40} gap="$2">
          {!showReplies ? (
            <XStack
              alignItems="center"
              gap="$1.5"
              cursor="pointer"
              onPress={() => setShowReplies(true)}
            >
              <Icons.CornerDownRight size={14} color={ui.textMuted} />
              <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
                View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </Text>
            </XStack>
          ) : (
            <>
              {replies.map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  isReply
                  canDelete={reply.userId === currentUserId}
                  onLike={() => onLikeComment(reply.id)}
                  onDelete={() => onDeleteComment(reply.id)}
                  onReply={() => openReply(reply.authorName)}
                />
              ))}
              <XStack
                alignItems="center"
                gap="$1.5"
                cursor="pointer"
                onPress={() => setShowReplies(false)}
              >
                <Icons.ChevronUp size={14} color={ui.textMuted} />
                <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
                  Hide replies
                </Text>
              </XStack>
            </>
          )}
        </YStack>
      ) : null}

      {replyOpen && isAuthenticated ? (
        <XStack gap="$2" alignItems="center" paddingLeft={40}>
          <MentionInput
            flex={1}
            value={replyDraft}
            onChangeText={setReplyDraft}
            onEncodedChange={(encoded) => {
              replyEncodedRef.current = encoded
            }}
            placeholder={`Reply to ${comment.authorName}…`}
            suggestionsPlacement="top"
            borderRadius={999}
            backgroundColor={ui.surface}
            autoFocus
            onSubmitEditing={submitReply}
          />
          <Button
            size="$3"
            backgroundColor={replyDraft.trim() ? BRAND_BLUE : ui.chip}
            color="white"
            borderRadius={999}
            disabled={!replyDraft.trim() || isSending}
            onPress={submitReply}
            icon={isSending ? <Spinner size="small" color="white" /> : <Icons.Send size={16} color="white" />}
          />
        </XStack>
      ) : null}
    </YStack>
  )
}

function CommentRow({
  comment,
  isReply = false,
  canDelete,
  onLike,
  onDelete,
  onReply,
}: {
  comment: PostComment
  isReply?: boolean
  canDelete: boolean
  onLike: () => void
  onDelete: () => Promise<unknown>
  onReply: () => void
}) {
  const ui = useAppUi()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  function confirmDelete() {
    const remove = async () => {
      setMenuOpen(false)
      setIsDeleting(true)
      await onDelete()
      setIsDeleting(false)
    }

    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Delete this comment? This cannot be undone.')) void remove()
      return
    }
    Alert.alert('Delete comment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ])
  }

  return (
    <XStack gap="$2" alignItems="flex-start">
      <ProfileLink userId={comment.userId}>
        <Avatar
          name={comment.authorName}
          src={comment.authorAvatar ?? undefined}
          size={isReply ? '$2' : '$3'}
          cursor="pointer"
        />
      </ProfileLink>
      <YStack flex={1} minWidth={0} gap={4}>
        <YStack
          backgroundColor={ui.surface}
          borderRadius={12}
          paddingHorizontal="$3"
          paddingVertical="$2"
          gap={2}
        >
          <XStack alignItems="center" gap="$2">
            <ProfileLink userId={comment.userId}>
              <Text fontSize={13} fontWeight="600" color={ui.text} cursor="pointer">
                {comment.authorName}
              </Text>
            </ProfileLink>
            {canDelete ? (
              <XStack
                marginLeft="auto"
                padding={3}
                borderRadius={999}
                cursor="pointer"
                opacity={isDeleting ? 0.5 : 1}
                onPress={() => !isDeleting && setMenuOpen((open) => !open)}
                accessibilityLabel="Comment options"
              >
                {isDeleting ? (
                  <Spinner size="small" />
                ) : (
                  <Icons.MoreHorizontal size={15} color={ui.textMuted} />
                )}
              </XStack>
            ) : null}
          </XStack>
          {menuOpen ? (
            <XStack
              alignSelf="flex-end"
              gap="$1.5"
              alignItems="center"
              paddingHorizontal="$2"
              paddingVertical="$1.5"
              borderRadius={8}
              backgroundColor={ui.surfaceMuted}
              cursor="pointer"
              onPress={confirmDelete}
            >
              <Icons.Trash2 size={13} color={ui.danger} />
              <Text fontSize={12} fontWeight="700" color={ui.danger}>
                Delete
              </Text>
            </XStack>
          ) : null}
          {comment.authorHeadline ? (
            <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
              {comment.authorHeadline}
            </Text>
          ) : null}
          <PostContentText
            content={comment.content}
            collapsible={false}
            fontSize={14}
            lineHeight={20}
          />
        </YStack>

        <XStack gap="$3" paddingLeft="$2" alignItems="center">
          <Text
            fontSize={12}
            fontWeight="700"
            color={comment.likedByMe ? BRAND_BLUE : ui.textMuted}
            cursor="pointer"
            onPress={onLike}
          >
            Like
          </Text>
          <Text
            fontSize={12}
            fontWeight="600"
            color={ui.textMuted}
            cursor="pointer"
            onPress={onReply}
          >
            Reply
          </Text>
          <Text fontSize={12} color={ui.textMuted}>
            {formatCommentTime(comment.createdAt)}
          </Text>
          {comment.likeCount > 0 ? (
            <XStack alignItems="center" gap={3} marginLeft="auto">
              <Icons.ThumbsUp size={12} color={BRAND_BLUE} fill={BRAND_BLUE} />
              <Text fontSize={12} color={ui.textMuted}>
                {comment.likeCount}
              </Text>
            </XStack>
          ) : null}
        </XStack>
      </YStack>
    </XStack>
  )
}
