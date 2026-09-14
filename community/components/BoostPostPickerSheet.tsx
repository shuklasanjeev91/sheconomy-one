import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'one'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import {
  fetchBoostablePosts,
  SPONSORED_STATUS_LABELS,
  type BoostablePost,
  type SponsoredCampaign,
} from '~/community/lib/sponsored-ads'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

const POST_TYPE_LABELS: Record<string, string> = {
  article: 'Article',
  poll: 'Poll',
  event: 'Event',
  celebration: 'Celebration',
  repost: 'Repost',
}

function formatPostTime(value: string | null) {
  if (!value) return ''
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

function postSummary(post: BoostablePost): string {
  const text = post.content.trim().replace(/\s+/g, ' ')
  if (text) return text
  const label = post.postType ? POST_TYPE_LABELS[post.postType] : null
  return label ? `${label} post` : 'Post without text'
}

/**
 * Lets advertisers pick which of their posts to boost. Campaigns are created
 * per post, so Ads Manager has no other way to start one.
 */
export function BoostPostPickerSheet({
  open,
  onOpenChange,
  campaigns,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaigns: SponsoredCampaign[]
}) {
  const ui = useAppUi()
  const router = useRouter()
  const { user } = useSupabase()
  const [posts, setPosts] = useState<BoostablePost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    const result = await fetchBoostablePosts(user.id)
    setPosts(result.data ?? [])
    setError(result.error)
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  function openBoost(postId: string, campaignId?: string) {
    const href = campaignId
      ? `${communityRoutes.boostPost(postId)}?campaign=${encodeURIComponent(campaignId)}`
      : communityRoutes.boostPost(postId)
    onOpenChange(false)
    router.push(href as never)
  }

  return (
    <CommunityAdaptiveSheet open={open} onOpenChange={onOpenChange} title="Choose a post to boost">
      <YStack gap="$3" paddingBottom="$4">
        {isLoading && !posts.length ? (
          <YStack padding="$8" alignItems="center">
            <Spinner size="large" />
          </YStack>
        ) : error && !posts.length ? (
          <YStack gap="$3" padding="$5" alignItems="center">
            <Text color={ui.danger} textAlign="center">
              {error}
            </Text>
            <Button tone="outline" onPress={load}>
              Retry
            </Button>
          </YStack>
        ) : posts.length === 0 ? (
          <YStack gap="$3" padding="$6" alignItems="center">
            <Icons.Megaphone size={36} color={ui.textMuted} />
            <Text fontSize={17} fontWeight="700" color={ui.text}>
              No posts to boost yet
            </Text>
            <Text color={ui.textSecondary} textAlign="center" lineHeight={21}>
              Only your public posts can be boosted. Create a public post, then come back here.
            </Text>
            <Button
              tone="primary"
              onPress={() => {
                onOpenChange(false)
                router.push(communityRoutes.createPost)
              }}
            >
              Create a post
            </Button>
          </YStack>
        ) : (
          posts.map((post) => {
            const campaign = campaigns.find((item) => item.post_id === post.id)
            const unfinished =
              campaign && ['draft', 'pending_payment', 'rejected'].includes(campaign.status)
                ? campaign
                : null
            const live = campaign && !unfinished ? campaign : null

            return (
              <YStack
                key={post.id}
                gap="$2"
                padding="$3"
                borderRadius="$4"
                borderWidth={1}
                borderColor={ui.border}
                backgroundColor={ui.surface}
              >
                <Text color={ui.text} numberOfLines={2} lineHeight={20}>
                  {postSummary(post)}
                </Text>
                <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
                  <Text fontSize={12} color={ui.textMuted}>
                    {[formatPostTime(post.createdAt), live ? SPONSORED_STATUS_LABELS[live.status] : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {live ? (
                    <Button
                      tone="outline"
                      size="$3"
                      onPress={() => {
                        onOpenChange(false)
                        router.push(communityRoutes.adCampaign(live.id))
                      }}
                    >
                      View results
                    </Button>
                  ) : (
                    <Button
                      tone="primary"
                      size="$3"
                      onPress={() => openBoost(post.id, unfinished?.id)}
                    >
                      {unfinished ? 'Finish setup' : 'Boost'}
                    </Button>
                  )}
                </XStack>
              </YStack>
            )
          })
        )}
      </YStack>
    </CommunityAdaptiveSheet>
  )
}
