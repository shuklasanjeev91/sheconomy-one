import { ProfileLink } from '~/community/components/ProfileLink'
import { PostContentText } from '~/community/components/PostContentText'
import type { PostComment } from '~/community/lib/post-engagement'
import { BRAND_BLUE } from '~/community/lib/constants'
import {
  Avatar,
  Button,
  Icons,
  Input,
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
  commentDraft: string
  isCommenting: boolean
  onDraftChange: (value: string) => void
  onSubmit: () => void
}

export function PostComments({
  comments,
  isLoading,
  isAuthenticated,
  commentDraft,
  isCommenting,
  onDraftChange,
  onSubmit,
}: PostCommentsProps) {
  const ui = useAppUi()

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
      ) : (
        <YStack gap="$3">
          {comments.map((comment) => (
            <XStack key={comment.id} gap="$2" alignItems="flex-start">
              <ProfileLink userId={comment.userId}>
                <Avatar
                  name={comment.authorName}
                  src={comment.authorAvatar ?? undefined}
                  size="$3"
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
                  <ProfileLink userId={comment.userId}>
                    <Text fontSize={13} fontWeight="600" color={ui.text} cursor="pointer">
                      {comment.authorName}
                    </Text>
                  </ProfileLink>
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
                <XStack gap="$3" paddingLeft="$2">
                  <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
                    Like
                  </Text>
                  <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
                    Reply
                  </Text>
                  <Text fontSize={12} color={ui.textMuted}>
                    {formatCommentTime(comment.createdAt)}
                  </Text>
                  {comment.likeCount > 0 ? (
                    <Text fontSize={12} color={ui.textMuted}>
                      · {comment.likeCount} like{comment.likeCount === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </XStack>
              </YStack>
            </XStack>
          ))}
        </YStack>
      )}

      {isAuthenticated ? (
        <XStack gap="$2" alignItems="center">
          <Input
            flex={1}
            value={commentDraft}
            onChangeText={onDraftChange}
            placeholder="Add a comment…"
            borderRadius={999}
            backgroundColor={ui.surface}
            onSubmitEditing={onSubmit}
          />
          <Button
            size="$3"
            backgroundColor={commentDraft.trim() ? BRAND_BLUE : ui.chip}
            color={commentDraft.trim() ? 'white' : ui.textMuted}
            borderRadius={999}
            disabled={!commentDraft.trim() || isCommenting}
            onPress={onSubmit}
            icon={isCommenting ? <Spinner size="small" color="white" /> : <Icons.Send size={16} color="white" />}
          />
        </XStack>
      ) : (
        <Text fontSize={13} color={ui.textMuted} textAlign="center">
          Sign in to join the conversation
        </Text>
      )}
    </YStack>
  )
}