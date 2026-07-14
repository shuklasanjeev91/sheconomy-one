import { Link, useParams, useRouter } from 'one'
import { useEffect, useState } from 'react'

import { SendPostSheet } from '~/chat/components/SendPostSheet'
import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { fetchPostById, type CommunityPost } from '~/community/lib/community'
import { useCommunityUi } from '~/community/lib/community-theme'
import { mentionsToPlainText } from '~/community/lib/mentions'
import { ShareActionRow, ShareSheet } from '~/components/share'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { chatRoutes, communityRoutes, routes } from '~/lib/routes'
import { getPostShareUrl } from '~/lib/share'
import { useSupabase } from '~/providers/SupabaseProvider'

export function PostDetailScreen() {
  const communityUi = useCommunityUi()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useSupabase()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    fetchPostById(id).then((result) => {
      if (result.ok) {
        setPost(result.data)
        setError(null)
      } else {
        setPost(null)
        setError(result.error)
      }
      setIsLoading(false)
    })
  }, [id])

  if (isLoading) {
    return (
      <CommunityShell wide>
        <YStack alignItems="center" paddingVertical="$10">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      </CommunityShell>
    )
  }

  if (!post) {
    return (
      <CommunityShell wide>
        <CommunityCard padding={24} gap={12}>
          <Text fontSize={18} fontWeight="600" color={communityUi.text}>
            Post unavailable
          </Text>
          <Text color={communityUi.textMuted}>{error ?? 'This post may have been removed.'}</Text>
          <Link href={communityRoutes.home} asChild>
            <Button
              backgroundColor={communityUi.brand}
              color="white"
              borderRadius={999}
              alignSelf="flex-start"
            >
              Back to feed
            </Button>
          </Link>
        </CommunityCard>
      </CommunityShell>
    )
  }

  const preview = post.content.trim().slice(0, 80) || 'Community post'
  const shareUrl = getPostShareUrl(post.id)
  const authorName = post.author?.full_name || post.author?.username || 'member'
  const postSnippet = mentionsToPlainText(post.content).trim().slice(0, 140)
  const sendContext = postSnippet
    ? `${authorName} on ${BRAND_NAME}: "${postSnippet}"`
    : `${authorName} on ${BRAND_NAME}`

  return (
    <CommunityShell wide>
      <YStack gap={12}>
        {/* Mobile already shows a back arrow in the app header and a share action
            on the post card, so this toolbar is desktop-only to avoid duplicates. */}
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap={12}
          display="none"
          $gtMd={{ display: 'flex' }}
        >
          <Button
            size="$3"
            tone="ghost"
            icon={<Icons.ArrowLeft size={18} color={communityUi.text} />}
            onPress={() => router.back()}
            paddingHorizontal={8}
          >
            Back
          </Button>
          <Button
            size="$3"
            tone="outline"
            borderRadius={999}
            icon={<Icons.Share2 size={15} />}
            onPress={() => setShareOpen(true)}
          >
            Share
          </Button>
        </XStack>
        <FeedPostCard post={post} linkToDetail={false} />
      </YStack>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share post"
        copyLabel="Copy post link"
        copyToastMessage="Post link copied to clipboard."
        payload={{
          url: shareUrl,
          title: preview,
          text: post.content.trim().slice(0, 140) || undefined,
        }}
        extraActions={
          <ShareActionRow
            icon={Icons.Send}
            label="Send in a message"
            onPress={() => {
              setShareOpen(false)
              if (!user?.id) {
                router.push(routes.signIn)
                return
              }
              setSendOpen(true)
            }}
          />
        }
      />

      {user?.id ? (
        <SendPostSheet
          open={sendOpen}
          onOpenChange={setSendOpen}
          currentUserId={user.id}
          shareUrl={shareUrl}
          contextText={sendContext}
          onSent={(conversationId) => router.push(chatRoutes.conversation(conversationId))}
        />
      ) : null}
    </CommunityShell>
  )
}
