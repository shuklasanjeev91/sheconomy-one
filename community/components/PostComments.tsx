import { useMemo, useRef, useState } from 'react'
import { Alert, Platform } from 'react-native'

import { CommentSuggestionChips } from '~/community/components/CommentSuggestionChips'
import { MentionInput } from '~/community/components/MentionInput'
import { ProfileConnectButton } from '~/community/components/ProfileConnectButton'
import { ProfileLink } from '~/community/components/ProfileLink'
import { PostContentText } from '~/community/components/PostContentText'
import { ReactionPicker } from '~/community/components/ReactionPicker'
import type { CommentSuggestionContext } from '~/community/lib/comment-suggestions'
import { REACTION_TYPES, type ReactionType } from '~/community/lib/constants'
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
  /** Post authors moderate their own post, so they can delete any comment on it. */
  canModerate?: boolean
  commentDraft: string
  isCommenting: boolean
  onDraftChange: (value: string) => void
  onSubmit: (encoded?: string) => void
  onLikeComment: (commentId: string, reactionType?: ReactionType) => void
  onEditComment: (commentId: string, content: string) => Promise<{ error?: string | null } | unknown>
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
  canModerate = false,
  commentDraft,
  isCommenting,
  onDraftChange,
  onSubmit,
  onLikeComment,
  onEditComment,
  onDeleteComment,
  onReply,
  suggestionContext,
}: PostCommentsProps) {
  const ui = useAppUi()
  const encodedRef = useRef('')
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)

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
              canModerate={canModerate}
              onLikeComment={onLikeComment}
              onEditComment={onEditComment}
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
            <YStack position="relative">
              <Button
                size="$3"
                tone="outline"
                borderRadius={999}
                disabled={isCommenting}
                onPress={() => setEmojiPickerOpen((open) => !open)}
                icon={<Icons.Smile size={16} color={ui.textMuted} />}
              />
              <ReactionPicker
                visible={emojiPickerOpen}
                onClose={() => setEmojiPickerOpen(false)}
                onSelect={(type) => {
                  const reaction = REACTION_TYPES.find((item) => item.type === type)
                  if (!reaction) return
                  const next = `${commentDraft}${reaction.emoji}`
                  encodedRef.current = next
                  onDraftChange(next)
                }}
              />
            </YStack>
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
  canModerate,
  onLikeComment,
  onEditComment,
  onDeleteComment,
  onReply,
}: {
  comment: PostComment
  replies: PostComment[]
  isAuthenticated: boolean
  currentUserId: string | null
  canModerate: boolean
  onLikeComment: (commentId: string, reactionType?: ReactionType) => void
  onEditComment: (commentId: string, content: string) => Promise<{ error?: string | null } | unknown>
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
        canEdit={comment.userId === currentUserId}
        canDelete={canModerate || comment.userId === currentUserId}
        onLike={(reactionType) => onLikeComment(comment.id, reactionType)}
        onEdit={(content) => onEditComment(comment.id, content)}
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
                  canEdit={reply.userId === currentUserId}
                  canDelete={canModerate || reply.userId === currentUserId}
                  onLike={(reactionType) => onLikeComment(reply.id, reactionType)}
                  onEdit={(content) => onEditComment(reply.id, content)}
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
  canEdit,
  canDelete,
  onLike,
  onEdit,
  onDelete,
  onReply,
}: {
  comment: PostComment
  isReply?: boolean
  canEdit: boolean
  canDelete: boolean
  onLike: (reactionType?: ReactionType) => void
  onEdit: (content: string) => Promise<unknown>
  onDelete: () => Promise<unknown>
  onReply: () => void
}) {
  const ui = useAppUi()
  const [editOpen, setEditOpen] = useState(false)
  const [editDraft, setEditDraft] = useState(comment.content)
  const [isEditing, setIsEditing] = useState(false)
  const editEncodedRef = useRef(comment.content)
  const [isDeleting, setIsDeleting] = useState(false)
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false)
  const myReaction = REACTION_TYPES.find((reaction) => reaction.type === comment.myReactionType)
  const reactionLabel = myReaction?.label ?? 'Like'

  async function submitEdit() {
    const body = (editEncodedRef.current || editDraft).trim()
    if (!body || isEditing) return
    setIsEditing(true)
    const result = (await onEdit(body)) as { error?: string | null } | undefined
    setIsEditing(false)
    if (result?.error) return
    setEditOpen(false)
  }

  function cancelEdit() {
    setEditDraft(comment.content)
    editEncodedRef.current = comment.content
    setEditOpen(false)
  }

  function confirmDelete() {
    const remove = async () => {
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
          <XStack alignItems="center" justifyContent="space-between" gap="$2" minWidth={0}>
            <ProfileLink userId={comment.userId}>
              <Text
                flexShrink={1}
                minWidth={0}
                fontSize={13}
                fontWeight="600"
                color={ui.text}
                cursor="pointer"
                numberOfLines={1}
              >
                {comment.authorName}
              </Text>
            </ProfileLink>
            {!canEdit ? (
              <ProfileConnectButton targetUserId={comment.userId} size="sm" />
            ) : null}
          </XStack>
          {comment.authorHeadline ? (
            <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
              {comment.authorHeadline}
            </Text>
          ) : null}
          {editOpen ? (
            <YStack gap="$2">
              <MentionInput
                value={editDraft}
                onChangeText={(text) => {
                  editEncodedRef.current = text
                  setEditDraft(text)
                }}
                onEncodedChange={(encoded) => {
                  editEncodedRef.current = encoded
                }}
                multiline
                autoFocus
                minHeight={64}
                backgroundColor={ui.surface}
                placeholder="Edit comment…"
              />
              <XStack gap="$2" justifyContent="flex-end">
                <Button size="$2" tone="outline" disabled={isEditing} onPress={cancelEdit}>
                  Cancel
                </Button>
                <Button
                  size="$2"
                  tone="primary"
                  disabled={!editDraft.trim() || isEditing}
                  icon={isEditing ? <Spinner size="small" color="white" /> : undefined}
                  onPress={() => void submitEdit()}
                >
                  {isEditing ? 'Saving…' : 'Save'}
                </Button>
              </XStack>
            </YStack>
          ) : (
            <PostContentText
              content={comment.content}
              collapsible={false}
              fontSize={14}
              lineHeight={20}
            />
          )}
        </YStack>

        {comment.likeCount > 0 ? (
          <XStack gap="$1.5" paddingLeft="$2" alignItems="center" flexWrap="wrap">
            {REACTION_TYPES.filter((reaction) => (comment.reactionCounts[reaction.type] ?? 0) > 0).map(
              (reaction) => (
                <XStack
                  key={reaction.type}
                  alignItems="center"
                  gap={3}
                  paddingHorizontal={7}
                  height={22}
                  borderRadius={999}
                  backgroundColor={ui.surface}
                  borderWidth={1}
                  borderColor={comment.myReactionType === reaction.type ? BRAND_BLUE : ui.borderSubtle}
                >
                  <Text fontSize={12}>{reaction.emoji}</Text>
                  <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
                    {comment.reactionCounts[reaction.type]}
                  </Text>
                </XStack>
              ),
            )}
          </XStack>
        ) : null}

        <XStack gap="$3" paddingLeft="$2" alignItems="center" flexWrap="wrap">
          <Text
            fontSize={12}
            fontWeight="700"
            color={comment.likedByMe ? BRAND_BLUE : ui.textMuted}
            cursor="pointer"
            onPress={() => onLike('like')}
          >
            {myReaction ? `${myReaction.emoji} ${reactionLabel}` : 'Like'}
          </Text>
          <YStack position="relative">
            <Text
              fontSize={12}
              fontWeight="600"
              color={ui.textMuted}
              cursor="pointer"
              onPress={() => setReactionPickerOpen((open) => !open)}
            >
              More
            </Text>
            <ReactionPicker
              visible={reactionPickerOpen}
              onClose={() => setReactionPickerOpen(false)}
              onSelect={(type) => {
                setReactionPickerOpen(false)
                onLike(type)
              }}
            />
          </YStack>
          <Text
            fontSize={12}
            fontWeight="600"
            color={ui.textMuted}
            cursor="pointer"
            onPress={onReply}
          >
            Reply
          </Text>
          {canEdit ? (
            <Text
              fontSize={12}
              fontWeight="600"
              color={ui.textMuted}
              cursor="pointer"
              onPress={() => {
                setEditDraft(comment.content)
                editEncodedRef.current = comment.content
                setEditOpen(true)
              }}
            >
              Edit
            </Text>
          ) : null}
          {canDelete ? (
            <Text
              fontSize={12}
              fontWeight="600"
              color={ui.danger}
              cursor="pointer"
              opacity={isDeleting ? 0.5 : 1}
              onPress={() => !isDeleting && confirmDelete()}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Text>
          ) : null}
          <Text fontSize={12} color={ui.textMuted}>
            {formatCommentTime(comment.createdAt)}
          </Text>
        </XStack>
      </YStack>
    </XStack>
  )
}
