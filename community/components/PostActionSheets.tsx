import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { PostComments } from '~/community/components/PostComments'
import { PostContentText } from '~/community/components/PostContentText'
import { ProfileLink } from '~/community/components/ProfileLink'
import type { usePostEngagement } from '~/community/hooks/usePostEngagement'
import { BRAND_BLUE, REACTION_TYPES } from '~/community/lib/constants'
import { useCommunityUi } from '~/community/lib/community-theme'
import { getPostShareUrl } from '~/community/lib/post-engagement'
import type { CommunityPost } from '~/community/lib/community'
import { ShareActionRow } from '~/components/share/ShareActionRow'
import { ShareSheet } from '~/components/share/ShareSheet'
import {
  Avatar,
  Button,
  Icons,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { chatRoutes, routes } from '~/lib/routes'
import { copyShareLink } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'

import { useRouter } from 'one'

import { BRAND_NAME } from '~/config/brand'

type Engagement = ReturnType<typeof usePostEngagement>

type PostActionSheetsProps = {
  post: CommunityPost
  engagement: Engagement
}

export function PostActionSheets({ post, engagement }: PostActionSheetsProps) {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const router = useRouter()
  const toast = useAppToast()
  const shareUrl = getPostShareUrl(post.id)
  const authorName = post.author?.full_name || post.author?.username || 'member'

  function requireAuth(action: string) {
    toast.show('Sign in required', {
      tone: 'default',
      message: `Sign in to ${action}.`,
    })
    router.push(routes.signIn)
  }

  async function copyLink() {
    const copied = await copyShareLink(shareUrl)
    if (copied) {
      toast.show('Link copied', { tone: 'success', message: 'Post link copied to clipboard.' })
      engagement.closeSheet()
      return
    }
    toast.show('Could not copy link', { tone: 'danger' })
  }

  return (
    <>
      <CommunityAdaptiveSheet
        open={engagement.activeSheet === 'reaction-picker'}
        onOpenChange={(open) => !open && engagement.closeSheet()}
        title="React to post"
      >
        <XStack justifyContent="space-around" paddingVertical="$4" flexWrap="wrap" gap={8}>
          {REACTION_TYPES.map((reaction, index) => (
            <YStack
              key={reaction.type}
              alignItems="center"
              gap={8}
              padding={12}
              borderRadius={12}
              cursor="pointer"
              opacity={engagement.isReacting ? 0.6 : 1}
              hoverStyle={{ backgroundColor: communityUi.divider, transform: [{ scale: 1.08 }] }}
              onPress={() => {
                if (!engagement.isAuthenticated) {
                  requireAuth('react')
                  return
                }
                engagement.pickReaction(reaction.type).then((result) => {
                  if (result?.error) {
                    toast.show('Could not react', { tone: 'danger', message: result.error })
                  }
                })
              }}
              style={{
                animation: `reactionPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.05}s both`,
              }}
            >
              <Text fontSize={40}>{reaction.emoji}</Text>
              <Text fontSize={12} fontWeight="600" color={communityUi.textMuted}>
                {reaction.label}
              </Text>
            </YStack>
          ))}
        </XStack>
        <style>{`
          @keyframes reactionPop {
            from { transform: scale(0.4) translateY(16px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
          }
        `}</style>
      </CommunityAdaptiveSheet>

      <CommunityAdaptiveSheet
        open={engagement.activeSheet === 'reactions'}
        onOpenChange={(open) => !open && engagement.closeSheet()}
        title={`${engagement.likeCount} reactions`}
        maxWidth={560}
      >
        {engagement.isLoadingReactions ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner />
          </YStack>
        ) : engagement.reactions.length === 0 ? (
          <Text color={ui.textMuted} textAlign="center" paddingVertical="$4">
            No reactions yet. Be the first to react.
          </Text>
        ) : (
          <YStack gap="$1">
            {engagement.reactions.map((reaction) => {
              const emoji =
                REACTION_TYPES.find((item) => item.type === reaction.reactionType)?.emoji ?? '👍'
              return (
                <ProfileLink key={`${reaction.userId}-${reaction.createdAt}`} userId={reaction.userId}>
                  <XStack
                    gap="$3"
                    alignItems="center"
                    paddingVertical="$2"
                    borderRadius={8}
                    cursor="pointer"
                    hoverStyle={{ backgroundColor: ui.surfaceHover }}
                  >
                    <Avatar
                      name={reaction.userName}
                      src={reaction.userAvatar ?? undefined}
                      size="$4"
                    />
                    <YStack flex={1} minWidth={0}>
                      <Text fontSize={15} fontWeight="600" color={ui.text} numberOfLines={1}>
                        {reaction.userName}
                      </Text>
                      {reaction.userHeadline ? (
                        <Text fontSize={13} color={ui.textMuted} numberOfLines={1}>
                          {reaction.userHeadline}
                        </Text>
                      ) : null}
                    </YStack>
                    <Text fontSize={20}>{emoji}</Text>
                  </XStack>
                </ProfileLink>
              )
            })}
          </YStack>
        )}
      </CommunityAdaptiveSheet>

      <CommunityAdaptiveSheet
        open={engagement.activeSheet === 'comments'}
        onOpenChange={(open) => !open && engagement.closeSheet()}
        title={`${engagement.commentCount} comments`}
        maxWidth={640}
      >
        <PostComments
          comments={engagement.comments}
          isLoading={engagement.isLoadingComments}
          isAuthenticated={engagement.isAuthenticated}
          commentDraft={engagement.commentDraft}
          isCommenting={engagement.isCommenting}
          onDraftChange={engagement.setCommentDraft}
          onSubmit={() => {
            if (!engagement.isAuthenticated) {
              requireAuth('comment')
              return
            }
            engagement.submitComment().then((result) => {
              if (result?.error) {
                toast.show('Could not comment', { tone: 'danger', message: result.error })
              }
            })
          }}
        />
      </CommunityAdaptiveSheet>

      <CommunityAdaptiveSheet
        open={engagement.activeSheet === 'repost'}
        onOpenChange={(open) => !open && engagement.closeSheet()}
        title="Repost"
        maxWidth={560}
      >
        <YStack gap="$4">
          <Text fontSize={14} color={ui.textSecondary} lineHeight={22}>
            Share this post with your network. Add your thoughts (optional).
          </Text>
          <YStack
            padding="$3"
            borderRadius={10}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surfaceMuted}
            gap="$2"
          >
            <Text fontSize={13} fontWeight="600" color={ui.text}>
              {authorName}
            </Text>
            <PostContentText content={post.content} collapsible={false} fontSize={14} lineHeight={20} />
          </YStack>
          <TextArea
            value={engagement.repostDraft}
            onChangeText={engagement.setRepostDraft}
            placeholder="Add a comment…"
            minHeight={100}
            backgroundColor={ui.surface}
          />
          <Button
            backgroundColor={BRAND_BLUE}
            color="white"
            borderRadius={999}
            disabled={engagement.isReposting}
            onPress={() => {
              if (!engagement.isAuthenticated) {
                requireAuth('repost')
                return
              }
              engagement.submitRepost().then((result) => {
                if (result?.error) {
                  toast.show('Could not repost', { tone: 'danger', message: result.error })
                } else {
                  toast.show('Reposted', { tone: 'success', message: 'Your repost is live.' })
                }
              })
            }}
            icon={engagement.isReposting ? <Spinner size="small" color="white" /> : undefined}
          >
            {engagement.isReposting ? 'Reposting…' : 'Repost'}
          </Button>
        </YStack>
      </CommunityAdaptiveSheet>

      <ShareSheet
        open={engagement.activeSheet === 'share'}
        onOpenChange={(open) => !open && engagement.closeSheet()}
        payload={{
          url: shareUrl,
          title: `${authorName} on ${BRAND_NAME}`,
          text: post.content.slice(0, 120),
        }}
        title="Send post"
        copyLabel="Copy link to post"
        copyToastMessage="Post link copied to clipboard."
        extraActions={
          <ShareActionRow
            icon={Icons.Send}
            label="Send in a message"
            onPress={() => {
              engagement.closeSheet()
              router.push(chatRoutes.home)
            }}
          />
        }
      />

      <CommunityAdaptiveSheet
        open={engagement.activeSheet === 'options'}
        onOpenChange={(open) => !open && engagement.closeSheet()}
        title="Post options"
        maxWidth={480}
      >
        <YStack gap="$2">
          <SheetAction
            icon={Icons.Bookmark}
            label="Save post"
            onPress={() => {
              toast.show('Saved', { tone: 'success', message: 'Post saved to your bookmarks.' })
              engagement.closeSheet()
            }}
          />
          <SheetAction icon={Icons.Link} label="Copy link to post" onPress={copyLink} />
          <SheetAction
            icon={Icons.Flag}
            label="Report post"
            onPress={() => {
              toast.show('Report submitted', {
                tone: 'success',
                message: `Thanks for helping keep ${BRAND_NAME} safe.`,
              })
              engagement.closeSheet()
            }}
          />
          <SheetAction
            icon={Icons.UserMinus}
            label={`Unfollow ${authorName.split(' ')[0]}`}
            onPress={() => {
              toast.show('Unfollowed', { tone: 'default', message: 'You will see fewer posts from ${authorName}.' })
              engagement.closeSheet()
            }}
          />
          <SheetAction
            icon={Icons.EyeOff}
            label="Hide post"
            onPress={() => {
              toast.show('Post hidden', { tone: 'default', message: 'This post will not appear in your feed.' })
              engagement.closeSheet()
            }}
          />
        </YStack>
      </CommunityAdaptiveSheet>
    </>
  )
}

function SheetAction({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof Icons.Link
  label: string
  onPress: () => void
}) {
  const ui = useAppUi()

  return (
    <XStack
      gap="$3"
      alignItems="center"
      paddingVertical="$3"
      paddingHorizontal="$2"
      borderRadius={10}
      cursor="pointer"
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
      onPress={onPress}
    >
      <Icon size={20} color={ui.textSecondary} />
      <Text fontSize={15} fontWeight="500" color={ui.text}>
        {label}
      </Text>
    </XStack>
  )
}