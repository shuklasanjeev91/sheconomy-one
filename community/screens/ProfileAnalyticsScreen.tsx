import { useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { CommunityShell } from '~/community/components/CommunityShell'
import { ProfileLink } from '~/community/components/ProfileLink'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  fetchProfileAnalytics,
  fetchRecentProfileViewers,
  type ProfileAnalytics,
  type ProfileViewer,
} from '~/community/lib/profile-views'
import {
  fetchShoppablePostInsights,
  type ShoppablePostInsights,
} from '~/community/lib/shoppable-post-insights'
import { trackCreatorCommerceInsightsView } from '~/community/lib/community-commerce-analytics'
import { Avatar, Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { communityRoutes, routes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useSupabase } from '~/providers/SupabaseProvider'

function formatViewedAt(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

/** Profile analytics: who viewed your profile + reach. */
export function ProfileAnalyticsScreen() {
  const communityUi = useCommunityUi()
  const { user } = useSupabase()
  const { profile } = useProfile()
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null)
  const [viewers, setViewers] = useState<ProfileViewer[]>([])
  const [shoppable, setShoppable] = useState<ShoppablePostInsights | null>(null)
  const [loading, setLoading] = useState(true)

  const userId = profile?.id ?? user?.id

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    void Promise.all([
      fetchProfileAnalytics(userId),
      fetchRecentProfileViewers(userId, 40),
      fetchShoppablePostInsights(userId),
    ]).then(([stats, viewersResult, shoppableInsights]) => {
      if (!active) return
      setAnalytics(stats)
      setViewers(viewersResult.items)
      setShoppable(shoppableInsights)
      trackCreatorCommerceInsightsView({
        postsWithProducts: shoppableInsights.postsWithProducts,
        uniqueListings: shoppableInsights.uniqueListingIds.length,
      })
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [userId])

  return (
    <CommunityShell>
      <CommunityPageHeader
        title="Profile analytics"
        subtitle="See who viewed your profile and how your network is growing."
      />

      {loading ? (
        <YStack padding="$6" alignItems="center">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      ) : (
        <YStack gap="$4" paddingBottom="$2">
          <XStack flexWrap="wrap" gap="$3">
            <StatChip
              label="Views (30d)"
              value={analytics?.profileViewsLast30Days ?? 0}
              color={communityUi.brand}
            />
            <StatChip
              label="Unique viewers"
              value={analytics?.uniqueViewersCount ?? 0}
              color={communityUi.brand}
            />
            <StatChip
              label="Engagement"
              value={analytics?.totalEngagement ?? 0}
              color="#059669"
            />
          </XStack>

          <SurfaceCard padding="$4" gap="$3">
            <XStack alignItems="center" gap="$2">
              <Icons.Eye size={18} color={communityUi.brand} />
              <Text fontSize={17} fontWeight="700" color={communityUi.text}>
                Who viewed your profile
              </Text>
            </XStack>
            <Text fontSize={13} color={communityUi.textMuted} lineHeight={19}>
              Named viewers from the last 30 days. You get an in-app and push alert the first time
              someone views you each day.
            </Text>

            {!viewers.length ? (
              <YStack paddingVertical="$4" gap="$2" alignItems="center">
                <Text fontSize={14} color={communityUi.textMuted} textAlign="center">
                  No profile views yet. Share your profile to grow your reach.
                </Text>
                <AppLink href={routes.profile} asChild>
                  <Button tone="secondary" size="$3" borderRadius={999}>
                    Open your profile
                  </Button>
                </AppLink>
              </YStack>
            ) : (
              <YStack gap="$2.5">
                {viewers.map((viewer) => (
                  <ProfileLink
                    key={`${viewer.viewerId}-${viewer.viewedAt}`}
                    userId={viewer.viewerId}
                    username={viewer.username}
                  >
                    <XStack
                      gap="$3"
                      alignItems="center"
                      paddingVertical="$2"
                      paddingHorizontal="$2"
                      borderRadius={12}
                      hoverStyle={{ backgroundColor: communityUi.divider }}
                      cursor="pointer"
                    >
                      <Avatar
                        name={viewer.fullName}
                        src={viewer.avatarUrl ?? undefined}
                        size="$4"
                      />
                      <YStack flex={1} gap={2} minWidth={0}>
                        <Text fontSize={15} fontWeight="600" color={communityUi.text} numberOfLines={1}>
                          {viewer.fullName}
                        </Text>
                        {viewer.headline ? (
                          <Text fontSize={13} color={communityUi.textMuted} numberOfLines={1}>
                            {viewer.headline}
                          </Text>
                        ) : null}
                      </YStack>
                      <Text fontSize={12} color={communityUi.textMuted}>
                        {formatViewedAt(viewer.viewedAt)}
                      </Text>
                    </XStack>
                  </ProfileLink>
                ))}
              </YStack>
            )}
          </SurfaceCard>

          {shoppable && shoppable.postsWithProducts > 0 ? (
            <SurfaceCard padding="$4" gap="$3">
              <XStack alignItems="center" gap="$2">
                <Icons.ShoppingBag size={18} color={communityUi.brand} />
                <Text fontSize={17} fontWeight="700" color={communityUi.text}>
                  Shoppable posts
                </Text>
              </XStack>
              <Text fontSize={13} color={communityUi.textMuted} lineHeight={19}>
                Products you have attached across recent community posts.
              </Text>
              <XStack flexWrap="wrap" gap="$3">
                <StatChip
                  label="Posts with products"
                  value={shoppable.postsWithProducts}
                  color={communityUi.brand}
                />
                <StatChip
                  label="Unique listings"
                  value={shoppable.uniqueListingIds.length}
                  color="#059669"
                />
              </XStack>
              {profile?.username ? (
                <AppLink href={communityRoutes.profileShop(profile.username)} asChild>
                  <Button tone="outline" size="$3" borderRadius={999}>
                    Open shop from posts
                  </Button>
                </AppLink>
              ) : null}
              {shoppable.topPosts.length ? (
                <YStack gap="$2">
                  {shoppable.topPosts.map((row) => (
                    <AppLink key={row.postId} href={communityRoutes.post(row.postId)} asChild>
                      <Button tone="ghost" size="$3" justifyContent="flex-start">
                        {row.productCount} product{row.productCount === 1 ? '' : 's'} attached
                      </Button>
                    </AppLink>
                  ))}
                </YStack>
              ) : null}
            </SurfaceCard>
          ) : null}

          <AppLink href={communityRoutes.peopleTab('suggestions')} asChild>
            <Button tone="outline" size="$4" borderRadius={999} icon={<Icons.Users size={16} />}>
              People you may know
            </Button>
          </AppLink>
        </YStack>
      )}
    </CommunityShell>
  )
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  const communityUi = useCommunityUi()
  return (
    <YStack
      flexGrow={1}
      flexBasis="30%"
      minWidth={110}
      padding="$3.5"
      borderRadius={14}
      backgroundColor={communityUi.surface}
      borderWidth={1}
      borderColor={communityUi.border}
      gap="$1"
    >
      <Text fontSize={22} fontWeight="800" color={color} letterSpacing={-0.4}>
        {value}
      </Text>
      <Text fontSize={12} fontWeight="600" color={communityUi.textMuted}>
        {label}
      </Text>
    </YStack>
  )
}
