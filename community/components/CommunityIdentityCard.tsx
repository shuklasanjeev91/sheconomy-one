import { useEffect, useState } from 'react'
import { Link } from 'one'
import type { Href } from 'one'
import { Platform } from 'react-native'

import { useCommunityUi } from '~/community/lib/community-theme'
import { fetchProfileAnalytics } from '~/community/lib/profile-views'
import { Avatar, Image, Text, XStack, YStack } from '~/components/ui'
import { useProfile } from '~/hooks/useProfile'
import { communityRoutes, routes } from '~/lib/routes'

/** professional profile identity card for the community left rail. */
export function CommunityIdentityCard() {
  const communityUi = useCommunityUi()
  const { profile, isAuthenticated } = useProfile()
  const [views30d, setViews30d] = useState<number | null>(null)

  useEffect(() => {
    if (!profile?.id) {
      setViews30d(null)
      return
    }
    let active = true
    void fetchProfileAnalytics(profile.id).then((data) => {
      if (active) setViews30d(data?.profileViewsLast30Days ?? null)
    })
    return () => {
      active = false
    }
  }, [profile?.id])

  if (!isAuthenticated || !profile) {
    return (
      <YStack
        backgroundColor={communityUi.cardBg}
        borderRadius={8}
        borderWidth={1}
        borderColor={communityUi.borderLight}
        overflow="hidden"
        marginBottom={8}
      >
        <YStack height={56} width="100%" style={{ background: communityUi.bannerGradient }} />
        <YStack paddingHorizontal={12} paddingBottom={14} gap={8} marginTop={-28}>
          <Avatar name="Guest" size="$5" borderWidth={2} borderColor={communityUi.cardBg} />
          <YStack gap={4}>
            <Text fontSize={15} fontWeight="700" color={communityUi.text}>
              Welcome to community
            </Text>
            <Text fontSize={12} color={communityUi.textMuted} lineHeight={16}>
              Sign in to see your network, profile views, and personalised feed.
            </Text>
          </YStack>
          <Link href={routes.signIn as Href}>
            <Text fontSize={13} fontWeight="700" color={communityUi.brand}>
              Sign in
            </Text>
          </Link>
        </YStack>
      </YStack>
    )
  }

  const displayName = profile.full_name || profile.username || 'You'
  const href = routes.profile as Href
  const followersHref = (
    profile.username
      ? communityRoutes.userFollowers(profile.username)
      : communityRoutes.peopleTab('followers')
  ) as Href

  return (
    <YStack
      backgroundColor={communityUi.cardBg}
      borderRadius={8}
      borderWidth={1}
      borderColor={communityUi.borderLight}
      overflow="hidden"
      marginBottom={8}
      style={Platform.OS === 'web' ? { boxShadow: communityUi.cardShadow } : undefined}
    >
      <Link href={href} asChild>
        <YStack cursor="pointer">
          <YStack height={56} width="100%" overflow="hidden" backgroundColor={communityUi.brand}>
            {profile.cover_url ? (
              <Image src={profile.cover_url} width="100%" height={56} objectFit="cover" alt="" />
            ) : (
              <YStack height={56} width="100%" style={{ background: communityUi.bannerGradient }} />
            )}
          </YStack>
          <YStack paddingHorizontal={12} paddingBottom={10} gap={6} marginTop={-28}>
            <Avatar
              name={displayName}
              src={profile.avatar_url ?? undefined}
              size="$5"
              borderWidth={2}
              borderColor={communityUi.cardBg}
            />
            <YStack gap={2}>
              <Text fontSize={15} fontWeight="700" color={communityUi.text} numberOfLines={1}>
                {displayName}
              </Text>
              {profile.headline ? (
                <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2} lineHeight={16}>
                  {profile.headline}
                </Text>
              ) : (
                <Text fontSize={12} color={communityUi.textSubtle} fontStyle="italic">
                  Add a headline
                </Text>
              )}
            </YStack>
          </YStack>
        </YStack>
      </Link>

      <YStack borderTopWidth={1} borderTopColor={communityUi.borderLight} paddingVertical={8}>
        <StatLink
          label="Connections"
          value={profile.connections_count ?? 0}
          href={communityRoutes.network as Href}
        />
        <StatLink label="Followers" value={profile.follower_count ?? 0} href={followersHref} />
        {views30d != null ? (
          <StatLink label="Profile viewers" value={views30d} href={href} />
        ) : null}
        {profile.profile_completion_percentage != null &&
        profile.profile_completion_percentage < 100 ? (
          <Link href={href}>
            <XStack
              paddingHorizontal={12}
              paddingVertical={8}
              justifyContent="space-between"
              alignItems="center"
              cursor="pointer"
              hoverStyle={{ backgroundColor: communityUi.hoverBg }}
            >
              <Text fontSize={12} color={communityUi.textMuted}>
                Profile strength
              </Text>
              <Text fontSize={12} fontWeight="700" color={communityUi.brand}>
                {profile.profile_completion_percentage}%
              </Text>
            </XStack>
          </Link>
        ) : null}
      </YStack>
    </YStack>
  )
}

function StatLink({ label, value, href }: { label: string; value: number; href: Href }) {
  const communityUi = useCommunityUi()

  return (
    <Link href={href}>
      <XStack
        paddingHorizontal={12}
        paddingVertical={6}
        justifyContent="space-between"
        alignItems="center"
        cursor="pointer"
        hoverStyle={{ backgroundColor: communityUi.hoverBg }}
      >
        <Text fontSize={12} fontWeight="600" color={communityUi.textMuted}>
          {label}
        </Text>
        <Text fontSize={12} fontWeight="700" color={communityUi.brand}>
          {value}
        </Text>
      </XStack>
    </Link>
  )
}
