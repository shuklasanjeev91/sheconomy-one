import { Link, useParams, useRouter } from 'one'
import { useEffect, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { fetchPostById, type CommunityPost } from '~/community/lib/community'
import { useCommunityUi } from '~/community/lib/community-theme'
import { ShareButton } from '~/components/share'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { getPostShareUrl } from '~/lib/share'

export function PostDetailScreen() {
  const communityUi = useCommunityUi()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

  return (
    <CommunityShell wide>
      <YStack gap={12}>
        <XStack alignItems="center" justifyContent="space-between" gap={12}>
          <Button
            size="$3"
            chromeless
            icon={<Icons.ArrowLeft size={18} color={communityUi.text} />}
            onPress={() => router.back()}
            paddingHorizontal={0}
          >
            Back
          </Button>
          <ShareButton
            variant="outline"
            label="Share"
            sheetTitle="Share post"
            copyLabel="Copy post link"
            copyToastMessage="Post link copied to clipboard."
            payload={{
              url: getPostShareUrl(post.id),
              title: preview,
              text: post.content.trim().slice(0, 140) || undefined,
            }}
          />
        </XStack>
        <FeedPostCard post={post} linkToDetail={false} />
      </YStack>
    </CommunityShell>
  )
}
