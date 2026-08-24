import { useLocalSearchParams, useParams, usePathname, useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useEffect, useMemo, useState } from 'react'

import { SendPostSheet } from '~/chat/components/SendPostSheet'
import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { PostDetailShopBanner } from '~/community/components/PostDetailShopBanner'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { fetchPostById, type CommunityPost } from '~/community/lib/community'
import { useCommunityUi } from '~/community/lib/community-theme'
import { mentionsToPlainText } from '~/community/lib/mentions'
import { collectPostMedia } from '~/community/lib/post-media'
import { ShareSheet } from '~/components/share'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { chatRoutes, communityRoutes } from '~/lib/routes'
import { getPostShareUrl } from '~/lib/share'
import { useSupabase } from '~/providers/SupabaseProvider'
import { usePageSeo } from '~/components/seo/RouteSeo'

function readRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

/** SPA deep links can leave `useParams` empty — fall back to local params / pathname. */
function usePostDetailId(): string {
  const routeParams = useParams<{ id?: string | string[] }>()
  const localParams = useLocalSearchParams<{ id?: string | string[] }>()
  const pathname = usePathname() ?? ''

  const fromParams = readRouteParam(routeParams.id) || readRouteParam(localParams.id)
  if (fromParams) {
    try {
      return decodeURIComponent(fromParams)
    } catch {
      return fromParams
    }
  }

  const match = pathname.match(/\/community\/post\/([^/?#]+)/i)
  if (!match?.[1] || match[1] === ':id') return ''
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function PostDetailScreen() {
  const communityUi = useCommunityUi()
  const id = usePostDetailId()
  const router = useRouter()
  const { user } = useSupabase()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)

  useEffect(() => {
    if (!id) {
      setPost(null)
      setError('Missing post id.')
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    void fetchPostById(id).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setPost(result.data)
        setError(null)
      } else {
        setPost(null)
        setError(result.error)
      }
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  usePageSeo(
    useMemo(() => {
      if (!post) return null
      const author = post.author?.full_name || post.author?.username || 'Community member'
      const snippet = mentionsToPlainText(post.content).replace(/\s+/g, ' ').trim().slice(0, 200)
      return {
        title: `${author} on ${BRAND_NAME}`,
        description: snippet || undefined,
        image: collectPostMedia(post)[0]?.url ?? post.author?.avatar_url ?? null,
        type: 'article' as const,
      }
    }, [post]),
  )

  // Edits made from other screens refresh this detail view in place.
  useAutoRefresh(INVALIDATION_TOPICS.communityPosts, () => {
    if (!id) return
    void fetchPostById(id).then((result) => {
      if (result.ok) {
        setPost(result.data)
        setError(null)
      }
    })
  })

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
          <AppLink href={communityRoutes.home} asChild>
            <Button
              backgroundColor={communityUi.brand}
              color="white"
              borderRadius={999}
              alignSelf="flex-start"
            >
              Open feed
            </Button>
          </AppLink>
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
  const sendPreview = {
    authorName,
    authorAvatar: post.author?.avatar_url ?? post.company?.logo_url ?? post.group?.avatar_url,
    snippet: postSnippet || null,
    thumbUrl: collectPostMedia(post)[0]?.url ?? null,
  }

  return (
    <CommunityShell wide>
      <YStack gap={12}>
        {/* Share stays desktop-only; back lives in the shared app header. */}
        <XStack
          alignItems="center"
          justifyContent="flex-end"
          gap={12}
          display="none"
          $gtMd={{ display: 'flex' }}
        >
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
        <PostDetailShopBanner post={post} />
        <FeedPostCard
          post={post}
          linkToDetail={false}
          commerceSource="post_detail"
          onPostUpdated={(_postId, patch) => setPost((current) => (current ? { ...current, ...patch } : current))}
          onPostDeleted={() => router.push(communityRoutes.home)}
        />
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
    </CommunityShell>
  )
}
