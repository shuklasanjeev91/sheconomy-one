import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'one'

import { FeedPostCard } from '~/community/components/FeedPostCard'
import { UserListBottomSheet } from '~/community/components/UserListBottomSheet'
import { ProfileBackgroundSections } from '~/community/components/profile/ProfileBackgroundSections'
import type { ProfileDisplay } from '~/community/components/profile/types'
import { useProfileDetails } from '~/community/hooks/useProfileDetails'
import { useUserPosts } from '~/community/hooks/useUserPosts'
import { BRAND_BLUE } from '~/community/lib/constants'
import type { CommunityPost } from '~/community/lib/community'
import { mergeProfileSocialLinks } from '~/community/lib/profile-details'
import type { UserListKind } from '~/community/lib/user-lists'
import {
  Avatar,
  Badge,
  Icons,
  Image,
  Paragraph,
  Spinner,
  Text,
  XStack,
  YStack,
  useMedia,
} from '~/components/ui'
import { ShareButton } from '~/components/share'
import { communityRoutes } from '~/lib/routes'
import { getProfileShareUrl } from '~/lib/share'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

type ProfileViewProps = {
  profile: ProfileDisplay
  isOwnProfile?: boolean
  headerActions?: ReactNode
  sidebarFooter?: ReactNode
}

export function ProfileView({
  profile,
  isOwnProfile = false,
  headerActions,
  sidebarFooter,
}: ProfileViewProps) {
  const media = useMedia()
  const isSideBySide = media.gtLg
  const { details, isLoading: detailsLoading, refresh } = useProfileDetails(profile.id)
  const { posts, isLoading: postsLoading } = useUserPosts(profile.id)

  const displayName = profile.full_name || profile.username
  const connectionsCount = profile.connections_count ?? 0
  const completion =
    details?.profileCompletion ?? profile.profile_completion_percentage ?? null
  const interests = details?.interests?.length
    ? details.interests
    : profile.interests ?? []
  const socialLinks = mergeProfileSocialLinks(profile, details?.socialLinks)
  const [listSheetKind, setListSheetKind] = useState<UserListKind | null>(null)
  const [listSheetOpen, setListSheetOpen] = useState(false)

  function openUserList(kind: UserListKind) {
    setListSheetKind(kind)
    setListSheetOpen(true)
  }

  const profileRail = (
    <YStack
      width={isSideBySide ? 300 : '100%'}
      maxWidth="100%"
      flexShrink={0}
      flexGrow={isSideBySide ? 0 : 1}
      gap="$4"
      alignSelf="stretch"
    >
      <StatsSidebar
        profile={profile}
        connectionsCount={connectionsCount}
        isOwnProfile={isOwnProfile}
        onOpenList={openUserList}
      />
      <LinksSidebar socialLinks={socialLinks} />
    </YStack>
  )

  return (
    <YStack width="100%" gap="$4" paddingBottom="$4">
      <ProfileHero
        profile={profile}
        displayName={displayName}
        connectionsCount={connectionsCount}
        headerActions={headerActions}
        isOwnProfile={isOwnProfile}
        onOpenConnections={() => openUserList('connections')}
      />

      {isOwnProfile && completion != null && completion < 100 ? (
        <ProfileCompletionCard percent={completion} />
      ) : null}

      <XStack
        gap="$4"
        alignItems="flex-start"
        flexDirection={isSideBySide ? 'row' : 'column'}
        flexWrap="wrap"
        width="100%"
      >
        {isSideBySide ? null : profileRail}

        <YStack flex={isSideBySide ? 1 : undefined} gap="$4" width="100%" minWidth={0} flexBasis={isSideBySide ? 0 : '100%'}>
          {detailsLoading && !details ? (
            <SectionCard title="Background">
              <YStack paddingVertical="$6" alignItems="center">
                <Spinner size="large" />
              </YStack>
            </SectionCard>
          ) : (
            <ProfileBackgroundSections
              profile={profile}
              details={details}
              interests={interests}
              isOwnProfile={isOwnProfile}
              onRefresh={refresh}
            />
          )}

          <ActivitySection posts={posts} postsLoading={postsLoading} isOwnProfile={isOwnProfile} />
          {sidebarFooter}
        </YStack>

        {isSideBySide ? profileRail : null}
      </XStack>

      <UserListBottomSheet
        open={listSheetOpen}
        onOpenChange={setListSheetOpen}
        kind={listSheetKind}
        userId={profile.id}
        isOwnProfile={isOwnProfile}
        subjectName={displayName}
      />
    </YStack>
  )
}

function ProfileHero({
  profile,
  displayName,
  connectionsCount,
  headerActions,
  isOwnProfile,
  onOpenConnections,
}: {
  profile: ProfileDisplay
  displayName: string
  connectionsCount: number
  headerActions?: ReactNode
  isOwnProfile: boolean
  onOpenConnections: () => void
}) {
  const ui = useAppUi()

  return (
    <YStack
      backgroundColor={ui.surface}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      overflow="hidden"
      style={getShadowStyle('sm')}
    >
      <CoverBanner coverUrl={profile.cover_url} />

      <YStack paddingHorizontal="$4" paddingBottom="$4">
        <XStack
          marginTop={-52}
          justifyContent="space-between"
          alignItems="flex-end"
          flexWrap="wrap"
          gap="$3"
          width="100%"
        >
          <Avatar
            name={displayName}
            src={profile.avatar_url ?? undefined}
            size="$10"
            borderWidth={4}
            borderColor={ui.surface}
            flexShrink={0}
            style={getShadowStyle('md')}
          />
          <XStack
            gap="$2"
            flexWrap="wrap"
            paddingTop="$2"
            alignItems="center"
            flex={1}
            justifyContent="flex-end"
            minWidth={0}
          >
            <ShareButton
              variant="outline"
              label="Share"
              sheetTitle="Share profile"
              copyLabel="Copy profile link"
              copyToastMessage="Profile link copied to clipboard."
              payload={{
                url: getProfileShareUrl(profile.username),
                title: displayName,
                text: profile.headline ?? undefined,
              }}
            />
            {headerActions}
          </XStack>
        </XStack>

        <YStack gap="$2" marginTop="$3">
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Text fontSize={26} fontWeight="700" color={ui.text} letterSpacing={-0.4}>
              {displayName}
            </Text>
            {profile.is_verified ? (
              <Badge tone="brand" size="sm">
                Verified
              </Badge>
            ) : null}
          </XStack>

          {profile.headline ? (
            <Text fontSize={16} color={ui.text} lineHeight={24} fontWeight="500">
              {profile.headline}
            </Text>
          ) : isOwnProfile ? (
            <Text fontSize={15} color={ui.textMuted} fontStyle="italic">
              Add a headline to tell people what you do
            </Text>
          ) : null}

          <XStack gap="$3" flexWrap="wrap" alignItems="center">
            {profile.location ? <MetaChip icon={Icons.MapPin} label={profile.location} /> : null}
            {profile.industry ? <MetaChip icon={Icons.Briefcase} label={profile.industry} /> : null}
            {connectionsCount > 0 ? (
              <Text
                fontSize={14}
                fontWeight="600"
                color={BRAND_BLUE}
                cursor="pointer"
                hoverStyle={{ opacity: 0.85 }}
                onPress={onOpenConnections}
              >
                {connectionsCount} connection{connectionsCount === 1 ? '' : 's'}
              </Text>
            ) : isOwnProfile ? (
              <Link href={communityRoutes.network}>
                <Text fontSize={14} fontWeight="600" color={BRAND_BLUE}>
                  Grow your network
                </Text>
              </Link>
            ) : null}
          </XStack>

          <Text fontSize={14} color={ui.textMuted}>
            @{profile.username}
          </Text>
        </YStack>
      </YStack>
    </YStack>
  )
}

function ProfileCompletionCard({ percent }: { percent: number }) {
  const ui = useAppUi()

  return (
    <YStack
      backgroundColor={ui.surface}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      padding="$4"
      gap="$3"
      style={getShadowStyle('sm')}
    >
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="600" color={ui.text}>
          Profile strength
        </Text>
        <Text fontSize={14} fontWeight="700" color={BRAND_BLUE}>
          {percent}%
        </Text>
      </XStack>
      <YStack height={6} borderRadius={999} backgroundColor={ui.surfaceMuted} overflow="hidden">
        <YStack
          height="100%"
          width={`${Math.min(100, Math.max(0, percent))}%`}
          backgroundColor={BRAND_BLUE}
          borderRadius={999}
        />
      </YStack>
      <Text fontSize={13} color={ui.textMuted} lineHeight={18}>
        Add experience, education, and skills to stand out to your network.
      </Text>
    </YStack>
  )
}

function ActivitySection({
  posts,
  postsLoading,
  isOwnProfile,
}: {
  posts: CommunityPost[]
  postsLoading: boolean
  isOwnProfile: boolean
}) {
  return (
    <SectionCard title="Activity" icon={Icons.Activity}>
      {postsLoading ? (
        <YStack paddingVertical="$6" alignItems="center">
          <Spinner size="large" />
        </YStack>
      ) : posts.length > 0 ? (
        <YStack gap="$3">
          {posts.map((post) => (
            <FeedPostCard key={post.id} post={post} />
          ))}
        </YStack>
      ) : (
        <YStack gap="$2">
          <Text color="$color10">
            {isOwnProfile
              ? 'You have not posted yet. Share an update with your network.'
              : 'No public posts yet.'}
          </Text>
          {isOwnProfile ? (
            <Link href={communityRoutes.home}>
              <Text color={BRAND_BLUE} fontWeight="600">
                Create a post
              </Text>
            </Link>
          ) : null}
        </YStack>
      )}
    </SectionCard>
  )
}

function StatsSidebar({
  profile,
  connectionsCount,
  isOwnProfile,
  onOpenList,
}: {
  profile: ProfileDisplay
  connectionsCount: number
  isOwnProfile: boolean
  onOpenList: (kind: UserListKind) => void
}) {
  return (
    <SectionCard title="Profile stats" icon={Icons.BarChart3}>
      <YStack gap="$3">
        <StatRow
          label="Followers"
          value={profile.follower_count ?? 0}
          onPress={() => onOpenList('followers')}
        />
        <StatRow
          label="Following"
          value={profile.following_count ?? 0}
          onPress={() => onOpenList('following')}
        />
        <StatRow
          label="Connections"
          value={connectionsCount}
          onPress={() => onOpenList('connections')}
        />
      </YStack>
    </SectionCard>
  )
}

function LinksSidebar({
  socialLinks,
}: {
  socialLinks: ReturnType<typeof mergeProfileSocialLinks>
}) {
  const links = [
    socialLinks.websiteUrl ? { href: socialLinks.websiteUrl, label: 'Website' } : null,
    socialLinks.portfolioUrl ? { href: socialLinks.portfolioUrl, label: 'Portfolio' } : null,
    socialLinks.instagramUrl ? { href: socialLinks.instagramUrl, label: 'Instagram' } : null,
    socialLinks.twitterUrl ? { href: socialLinks.twitterUrl, label: 'Twitter / X' } : null,
    socialLinks.youtubeUrl ? { href: socialLinks.youtubeUrl, label: 'YouTube' } : null,
    socialLinks.githubUrl ? { href: socialLinks.githubUrl, label: 'GitHub' } : null,
  ].filter(Boolean) as { href: string; label: string }[]

  if (!links.length) return null

  return (
    <SectionCard title="Links" icon={Icons.Link}>
      <YStack gap="$2">
        {links.map((link) => (
          <ExternalLink key={link.label} href={link.href} label={link.label} />
        ))}
      </YStack>
    </SectionCard>
  )
}

function SectionCard({
  title,
  icon: Icon,
  children,
  emptyMessage,
  emptyAction,
}: {
  title: string
  icon?: typeof Icons.User
  children?: ReactNode
  emptyMessage?: string
  emptyAction?: ReactNode
}) {
  const ui = useAppUi()
  const showEmpty = !children && emptyMessage

  return (
    <YStack
      backgroundColor={ui.surface}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      padding="$4"
      gap="$3"
      style={getShadowStyle('sm')}
    >
      <XStack gap="$2.5" alignItems="center">
        <YStack width={3} height={20} borderRadius={999} backgroundColor={ui.brand} opacity={0.85} />
        {Icon ? <Icon size={18} color={BRAND_BLUE} /> : null}
        <Text fontSize={18} fontWeight="700" color={ui.text} letterSpacing={-0.25}>
          {title}
        </Text>
      </XStack>
      {showEmpty ? (
        <YStack gap="$2">
          <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
            {emptyMessage}
          </Text>
          {emptyAction}
        </YStack>
      ) : (
        children
      )}
    </YStack>
  )
}

function MetaChip({
  icon: Icon,
  label,
}: {
  icon: typeof Icons.MapPin
  label: string
}) {
  const ui = useAppUi()

  return (
    <XStack gap={6} alignItems="center">
      <Icon size={14} color={ui.textMuted} />
      <Text fontSize={14} color={ui.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}

function StatRow({
  label,
  value,
  onPress,
}: {
  label: string
  value: number
  onPress?: () => void
}) {
  const ui = useAppUi()

  const row = (
    <XStack justifyContent="space-between" alignItems="center">
      <Text fontSize={14} color={ui.textMuted}>
        {label}
      </Text>
      <Text fontSize={16} fontWeight="700" color={onPress && value > 0 ? BRAND_BLUE : ui.text}>
        {value}
      </Text>
    </XStack>
  )

  if (!onPress || value === 0) return row

  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      cursor="pointer"
      hoverStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <Text fontSize={14} color={ui.textMuted}>
        {label}
      </Text>
      <Text fontSize={16} fontWeight="700" color={BRAND_BLUE}>
        {value}
      </Text>
    </XStack>
  )
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} target="_blank">
      <XStack gap="$2" alignItems="center" cursor="pointer" hoverStyle={{ opacity: 0.85 }}>
        <Icons.ExternalLink size={14} color={BRAND_BLUE} />
        <Text color={BRAND_BLUE} fontSize={14} fontWeight="500" numberOfLines={1}>
          {label}
        </Text>
      </XStack>
    </Link>
  )
}

function CoverBanner({ coverUrl }: { coverUrl?: string | null }) {
  const ui = useAppUi()

  if (coverUrl) {
    return (
      <YStack height={200} width="100%" backgroundColor={ui.imagePlaceholder} overflow="hidden">
        <Image src={coverUrl} width="100%" height={200} objectFit="cover" alt="" />
      </YStack>
    )
  }

  return (
    <YStack
      height={200}
      width="100%"
      style={{
        background: 'linear-gradient(135deg, #004182 0%, #0a66c2 50%, #378fe9 100%)',
      }}
    />
  )
}