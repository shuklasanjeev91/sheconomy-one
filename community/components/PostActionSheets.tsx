import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { SendPostSheet } from '~/chat/components/SendPostSheet'
import { WebOnlyStyle } from '~/components/platform/WebOnlyStyle'
import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { MentionInput } from '~/community/components/MentionInput'
import { PostComments } from '~/community/components/PostComments'
import { ProfileLink } from '~/community/components/ProfileLink'
import { RepostPreviewCard } from '~/community/components/RepostPreviewCard'
import type { usePostEngagement } from '~/community/hooks/usePostEngagement'
import { BRAND_BLUE, REACTION_TYPES } from '~/community/lib/constants'
import { useCommunityUi } from '~/community/lib/community-theme'
import { mentionsToPlainText } from '~/community/lib/mentions'
import { setPostFeatured } from '~/community/lib/featured-posts'
import {
  blockCommunityMember,
  hideCommunityPost,
  reportCommunityPost,
  unhideCommunityPost,
} from '~/community/lib/moderation'
import { feedback } from '~/lib/platform/feedback'
import { unfollowProfile } from '~/community/lib/profile-follows'
import { isPostSaved, saveCommunityPost, unsaveCommunityPost } from '~/community/lib/saved-posts'
import { getPostShareUrl } from '~/community/lib/post-engagement'
import {
  deleteCommunityPost,
  updateCommunityPost,
  type CommunityPost,
} from '~/community/lib/community'
import { collectPostMedia, postHasMedia } from '~/community/lib/post-media'
import { ShareSheet } from '~/components/share/ShareSheet'
import {
  Avatar,
  Button,
  Icons,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { appRoutes, chatRoutes, routes } from '~/lib/routes'
import { copyShareLink } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

import { useRouter } from 'one'

import { BRAND_NAME } from '~/config/brand'

type Engagement = ReturnType<typeof usePostEngagement>

type PostActionSheetsProps = {
  post: CommunityPost
  engagement: Engagement
  onPostUpdated?: (postId: string, patch: Partial<CommunityPost>) => void
  onPostDeleted?: (postId: string) => void
}

const NON_EDITABLE_POST_TYPES = new Set(['poll', 'event', 'celebration', 'product', 'service'])

export function PostActionSheets({
  post,
  engagement,
  onPostUpdated,
  onPostDeleted,
}: PostActionSheetsProps) {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const router = useRouter()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [sendOpen, setSendOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [isFeaturing, setIsFeaturing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingAction, setSavingAction] = useState(false)
  const [editDraft, setEditDraft] = useState(post.content)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const editEncodedRef = useRef('')

  useEffect(() => {
    if (engagement.activeSheet !== 'edit') return
    setEditDraft(post.content)
    editEncodedRef.current = post.content
  }, [engagement.activeSheet, post.content])

  useEffect(() => {
    if (!user?.id || engagement.activeSheet !== 'options') return
    let active = true
    void isPostSaved(user.id, post.id).then((value) => {
      if (active) setSaved(value)
    })
    return () => {
      active = false
    }
  }, [engagement.activeSheet, post.id, user?.id])
  const repostEncodedRef = useRef('')
  const shareUrl = getPostShareUrl(post.id)
  const authorName = post.author?.full_name || post.author?.username || 'member'
  const isOwnPost = !!user?.id && user.id === post.user_id
  const canEditPost =
    isOwnPost && (!post.post_type || !NON_EDITABLE_POST_TYPES.has(post.post_type))
  const postSnippet = mentionsToPlainText(post.content).trim().slice(0, 140)
  const sendContext = postSnippet
    ? `${authorName} on ${BRAND_NAME}: "${postSnippet}"`
    : `${authorName} on ${BRAND_NAME}`
  const sendPreview = {
    authorName,
    authorAvatar: post.author?.avatar_url ?? post.company?.logo_url ?? post.group?.avatar_url,
    snippet: postSnippet || null,
    thumbUrl: collectPostMedia(post)[0]?.url ?? null,
  }

  function requireAuth(action: string) {
    toast.show('Sign in required', {
      tone: 'default',
      message: `Sign in to ${action}.`,
    })
    router.push(routes.signIn)
  }

  useEffect(() => {
    if (engagement.activeSheet !== 'send') return
    if (!user?.id) {
      requireAuth('send this post')
      engagement.closeSheet()
      return
    }
    setSendOpen(true)
    engagement.closeSheet()
  }, [engagement.activeSheet, user?.id])

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
              style={
                Platform.OS === 'web'
                  ? {
                      animation: `reactionPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.05}s both`,
                    }
                  : undefined
              }
            >
              <Text fontSize={40}>{reaction.emoji}</Text>
              <Text fontSize={12} fontWeight="600" color={communityUi.textMuted}>
                {reaction.label}
              </Text>
            </YStack>
          ))}
        </XStack>
        <WebOnlyStyle>{`
          @keyframes reactionPop {
            from { transform: scale(0.4) translateY(16px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
          }
        `}</WebOnlyStyle>
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
          suggestionContext={{
            postType: post.post_type,
            content: post.content,
            authorName: authorName,
            eventTitle: post.event_title,
            celebrationTitle: post.celebration?.title ?? post.celebration?.occasion,
            productTitle: post.product?.title,
            shopName: post.shop?.name,
            articleTitle: post.article_title,
            hasMedia: postHasMedia(post),
          }}
          onSubmit={(encoded) => {
            if (!engagement.isAuthenticated) {
              requireAuth('comment')
              return
            }
            engagement.submitComment(encoded).then((result) => {
              if (result?.error) {
                toast.show('Could not comment', { tone: 'danger', message: result.error })
              }
            })
          }}
          onLikeComment={(commentId) => {
            if (!engagement.isAuthenticated) {
              requireAuth('react')
              return
            }
            engagement.toggleCommentLike(commentId).then((result) => {
              if (result?.error) {
                toast.show('Could not like comment', { tone: 'danger', message: result.error })
              }
            })
          }}
          onReply={(parentId, encoded) => {
            if (!engagement.isAuthenticated) {
              requireAuth('comment')
              return
            }
            return engagement.replyToComment(parentId, encoded).then((result) => {
              if (result?.error) {
                toast.show('Could not reply', { tone: 'danger', message: result.error })
              }
              return result
            })
          }}
        />
      </CommunityAdaptiveSheet>

      <CommunityAdaptiveSheet
        open={engagement.activeSheet === 'repost-menu'}
        onOpenChange={(open) => !open && engagement.closeSheet()}
        title="Repost"
        maxWidth={420}
      >
        <YStack gap="$1">
          <SheetAction
            icon={Icons.Repeat2}
            label="Repost"
            description="Instantly share this post to your feed"
            onPress={() => {
              if (!engagement.isAuthenticated) {
                requireAuth('repost')
                return
              }
              engagement.submitRepost('').then((result) => {
                if (result?.error) {
                  toast.show('Could not repost', { tone: 'danger', message: result.error })
                  return
                }
                toast.show('Reposted', {
                  tone: 'success',
                  message: 'Shared to your feed.',
                })
              })
            }}
          />
          <SheetAction
            icon={Icons.Pencil}
            label="Repost with your thoughts"
            description="Add a comment before sharing"
            onPress={() => engagement.openSheet('repost')}
          />
        </YStack>
      </CommunityAdaptiveSheet>

      <CommunityAdaptiveSheet
        open={engagement.activeSheet === 'repost'}
        onOpenChange={(open) => !open && engagement.closeSheet()}
        title="Repost with your thoughts"
        maxWidth={560}
      >
        <YStack gap="$4">
          <MentionInput
            multiline
            value={engagement.repostDraft}
            onChangeText={engagement.setRepostDraft}
            onEncodedChange={(encoded) => {
              repostEncodedRef.current = encoded
            }}
            placeholder="What do you want to talk about?"
            suggestionsPlacement="top"
            minHeight={110}
            backgroundColor={ui.surface}
          />
          <RepostPreviewCard post={post} />
          <XStack justifyContent="flex-end" gap="$2">
            <Button
              backgroundColor="transparent"
              color={ui.textSecondary}
              borderRadius={999}
              onPress={() => engagement.closeSheet()}
            >
              Cancel
            </Button>
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
                engagement
                  .submitRepost(repostEncodedRef.current || engagement.repostDraft)
                  .then((result) => {
                    if (result?.error) {
                      toast.show('Could not repost', { tone: 'danger', message: result.error })
                    } else {
                      toast.show('Reposted', {
                        tone: 'success',
                        message: 'Your repost is live.',
                      })
                    }
                  })
              }}
              icon={engagement.isReposting ? <Spinner size="small" color="white" /> : undefined}
            >
              {engagement.isReposting ? 'Posting…' : 'Post'}
            </Button>
          </XStack>
        </YStack>
      </CommunityAdaptiveSheet>

      <ShareSheet
        open={shareOpen || engagement.activeSheet === 'share'}
        onOpenChange={(open) => {
          setShareOpen(open)
          if (!open && engagement.activeSheet === 'share') engagement.closeSheet()
        }}
        payload={{
          url: shareUrl,
          title: `${authorName} on ${BRAND_NAME}`,
          text: mentionsToPlainText(post.content).slice(0, 120),
        }}
        title="Share post"
        copyLabel="Copy link to post"
        copyToastMessage="Post link copied to clipboard."
      />

      {user?.id ? (
        <SendPostSheet
          open={sendOpen}
          onOpenChange={setSendOpen}
          currentUserId={user.id}
          shareUrl={shareUrl}
          contextText={sendContext}
          preview={sendPreview}
          onShareElsewhere={() => setShareOpen(true)}
          onSent={(conversationId) => router.push(chatRoutes.conversation(conversationId))}
        />
      ) : null}

      <CommunityAdaptiveSheet
        open={engagement.activeSheet === 'options'}
        onOpenChange={(open) => !open && engagement.closeSheet()}
        title="Post options"
        maxWidth={480}
      >
        <YStack gap="$2">
          {canEditPost ? (
            <SheetAction
              icon={Icons.Pencil}
              label="Edit post"
              description="Update what you wrote"
              onPress={() => engagement.openSheet('edit')}
            />
          ) : null}
          {isOwnPost ? (
            <SheetAction
              icon={Icons.Trash2}
              label="Delete post"
              description="Remove this post from the feed"
              onPress={() => engagement.openSheet('delete-confirm')}
            />
          ) : null}
          {isOwnPost ? (
            <SheetAction
              icon={Icons.Star}
              label={post.is_pinned ? 'Remove from Featured' : 'Add to Featured'}
              onPress={() => {
                if (!user?.id || isFeaturing) return
                setIsFeaturing(true)
                void setPostFeatured(post.id, user.id, !post.is_pinned).then((result) => {
                  setIsFeaturing(false)
                  if (result.error) {
                    toast.show('Could not update Featured', {
                      tone: 'danger',
                      message: result.error,
                    })
                    return
                  }
                  post.is_pinned = !post.is_pinned
                  toast.show(
                    post.is_pinned ? 'Added to Featured' : 'Removed from Featured',
                    { tone: 'success' },
                  )
                  engagement.closeSheet()
                })
              }}
            />
          ) : null}
          <SheetAction
            icon={Icons.Bookmark}
            label={saved ? 'Unsave post' : 'Save post'}
            onPress={() => {
              if (!user?.id) {
                requireAuth('save posts')
                return
              }
              if (savingAction) return
              setSavingAction(true)
              const action = saved
                ? unsaveCommunityPost(user.id, post.id)
                : saveCommunityPost(user.id, post.id)
              void action.then((result) => {
                setSavingAction(false)
                if (result.error) {
                  toast.show('Could not update saved posts', {
                    tone: 'danger',
                    message: result.error,
                  })
                  return
                }
                setSaved(!saved)
                toast.show(saved ? 'Removed from Saved' : 'Saved', {
                  tone: 'success',
                  message: saved
                    ? 'Post removed from your saved items.'
                    : 'Post saved to your bookmarks.',
                })
                engagement.closeSheet()
              })
            }}
          />
          <SheetAction icon={Icons.Link} label="Copy link to post" onPress={copyLink} />
          <SheetAction
            icon={Icons.Flag}
            label="Report post"
            onPress={() => {
              if (!user?.id) {
                requireAuth('report posts')
                return
              }
              void reportCommunityPost(user.id, post.id, 'spam').then((result) => {
                if (result.error) {
                  toast.show('Could not report post', { tone: 'danger', message: result.error })
                  return
                }
                toast.show('Report submitted', {
                  tone: 'success',
                  message: `Thanks for helping keep ${BRAND_NAME} safe.`,
                })
                engagement.closeSheet()
              })
            }}
          />
          {!isOwnPost ? (
            <SheetAction
              icon={Icons.UserMinus}
              label={`Unfollow ${authorName.split(' ')[0]}`}
              onPress={() => {
                if (!user?.id) {
                  requireAuth('unfollow')
                  return
                }
                void unfollowProfile(user.id, post.user_id).then((result) => {
                  if (result.error) {
                    toast.show('Could not unfollow', { tone: 'danger', message: result.error })
                    return
                  }
                  toast.show('Unfollowed', {
                    tone: 'default',
                    message: `You will see fewer posts from ${authorName}.`,
                  })
                  engagement.closeSheet()
                })
              }}
            />
          ) : null}
          {!isOwnPost ? (
            <SheetAction
              icon={Icons.UserX}
              label={`Block ${authorName.split(' ')[0]}`}
              onPress={() => {
                if (!user?.id) {
                  requireAuth('block members')
                  return
                }
                void blockCommunityMember(user.id, post.user_id).then((result) => {
                  if (result.error) {
                    toast.show('Could not block', { tone: 'danger', message: result.error })
                    return
                  }
                  void feedback('destructive')
                  toast.show('Member blocked', {
                    tone: 'default',
                    message: `${authorName} will no longer appear in your community feed.`,
                    actionLabel: 'Manage',
                    onAction: () => router.push(appRoutes.settingsSection('privacy') as never),
                  })
                  engagement.closeSheet()
                })
              }}
            />
          ) : null}
          {!isOwnPost ? (
            <SheetAction
              icon={Icons.EyeOff}
              label="Hide post"
              onPress={() => {
                if (!user?.id) {
                  requireAuth('hide posts')
                  return
                }
                void hideCommunityPost(user.id, post.id).then((result) => {
                  if (result.error) {
                    toast.show('Could not hide post', { tone: 'danger', message: result.error })
                    return
                  }
                  void feedback('selection')
                  onPostDeleted?.(post.id)
                  engagement.closeSheet()
                  toast.show('Post hidden', {
                    tone: 'default',
                    message: 'This post will not appear in your feed.',
                    duration: 6000,
                    actionLabel: 'Undo',
                    onAction: () => {
                      void unhideCommunityPost(user.id, post.id).then((undoResult) => {
                        if (undoResult.error) {
                          toast.show('Could not undo', {
                            tone: 'danger',
                            message: undoResult.error,
                          })
                          return
                        }
                        toast.show('Post restored', { tone: 'success' })
                        // Soft restore: refresh feed so the post can return.
                        engagement.closeSheet()
                      })
                    },
                  })
                })
              }}
            />
          ) : null}
        </YStack>
      </CommunityAdaptiveSheet>

      <CommunityAdaptiveSheet
        open={engagement.activeSheet === 'edit'}
        onOpenChange={(open) => !open && engagement.closeSheet()}
        title="Edit post"
        maxWidth={560}
      >
        <YStack gap="$4">
          <MentionInput
            multiline
            value={editDraft}
            onChangeText={setEditDraft}
            onEncodedChange={(encoded) => {
              editEncodedRef.current = encoded
            }}
            placeholder="What do you want to talk about?"
            suggestionsPlacement="top"
            minHeight={110}
            backgroundColor={ui.surface}
          />
          <XStack justifyContent="flex-end" gap="$2">
            <Button
              backgroundColor="transparent"
              color={ui.textSecondary}
              borderRadius={999}
              onPress={() => engagement.closeSheet()}
            >
              Cancel
            </Button>
            <Button
              backgroundColor={BRAND_BLUE}
              color="white"
              borderRadius={999}
              disabled={isEditing || !editDraft.trim()}
              onPress={() => {
                if (!user?.id) {
                  requireAuth('edit posts')
                  return
                }
                const nextContent = editEncodedRef.current || editDraft
                if (!nextContent.trim()) return
                setIsEditing(true)
                void updateCommunityPost(user.id, post.id, { content: nextContent }).then(
                  (result) => {
                    setIsEditing(false)
                    if (result.error) {
                      toast.show('Could not update post', {
                        tone: 'danger',
                        message: result.error,
                      })
                      return
                    }
                    post.content = nextContent
                    onPostUpdated?.(post.id, { content: nextContent })
                    toast.show('Post updated', { tone: 'success' })
                    engagement.closeSheet()
                  },
                )
              }}
              icon={isEditing ? <Spinner size="small" color="white" /> : undefined}
            >
              {isEditing ? 'Saving…' : 'Save'}
            </Button>
          </XStack>
        </YStack>
      </CommunityAdaptiveSheet>

      <CommunityAdaptiveSheet
        open={engagement.activeSheet === 'delete-confirm'}
        onOpenChange={(open) => !open && engagement.closeSheet()}
        title="Delete post?"
        maxWidth={420}
      >
        <YStack gap="$4">
          <Text color={ui.textMuted} fontSize={14}>
            This will permanently remove your post from the feed. You cannot undo this action.
          </Text>
          <XStack justifyContent="flex-end" gap="$2">
            <Button
              backgroundColor="transparent"
              color={ui.textSecondary}
              borderRadius={999}
              onPress={() => engagement.closeSheet()}
            >
              Cancel
            </Button>
            <Button
              backgroundColor={ui.error}
              color="white"
              borderRadius={999}
              disabled={isDeleting}
              onPress={() => {
                if (!user?.id) {
                  requireAuth('delete posts')
                  return
                }
                setIsDeleting(true)
                void deleteCommunityPost(user.id, post.id).then((result) => {
                  setIsDeleting(false)
                  if (result.error) {
                    toast.show('Could not delete post', {
                      tone: 'danger',
                      message: result.error,
                    })
                    return
                  }
                  onPostDeleted?.(post.id)
                  toast.show('Post deleted', { tone: 'success' })
                  engagement.closeSheet()
                })
              }}
              icon={isDeleting ? <Spinner size="small" color="white" /> : undefined}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </XStack>
        </YStack>
      </CommunityAdaptiveSheet>
    </>
  )
}

function SheetAction({
  icon: Icon,
  label,
  description,
  onPress,
}: {
  icon: typeof Icons.Link
  label: string
  description?: string
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
      <YStack
        width={40}
        height={40}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.surfaceMuted}
      >
        <Icon size={20} color={ui.textSecondary} />
      </YStack>
      <YStack flex={1} minWidth={0} gap={2}>
        <Text fontSize={15} fontWeight="600" color={ui.text}>
          {label}
        </Text>
        {description ? (
          <Text fontSize={13} color={ui.textMuted} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </YStack>
    </XStack>
  )
}