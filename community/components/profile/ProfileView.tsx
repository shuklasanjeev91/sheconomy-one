import type { ReactNode } from 'react'
import { Link } from 'one'

import { FeedPostCard } from '~/community/components/FeedPostCard'
import type { ProfileDisplay } from '~/community/components/profile/types'
import { useProfileDetails } from '~/community/hooks/useProfileDetails'
import { useUserPosts } from '~/community/hooks/useUserPosts'
import { BRAND_BLUE } from '~/community/lib/constants'
import type { CommunityPost } from '~/community/lib/community'
import type { ProfileEducation, ProfileExperience, ProfileLanguage, ProfileSkill } from '~/community/lib/profile-details'
import { mergeProfileSocialLinks } from '~/community/lib/profile-details'
import {
  formatDurationMonths,
  formatEducationYearRange,
  formatExperienceDateRange,
  parseSkillTags,
} from '~/community/lib/profile-format'
import {
  Avatar,
  Badge,
  Icons,
  Image,
  Paragraph,
  Separator,
  Spinner,
  Text,
  XStack,
  YStack,
  useMedia,
} from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
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
  const { details, isLoading: detailsLoading } = useProfileDetails(profile.id)
  const { posts, isLoading: postsLoading } = useUserPosts(profile.id)

  const displayName = profile.full_name || profile.username
  const connectionsCount = profile.connections_count ?? 0
  const completion =
    details?.profileCompletion ?? profile.profile_completion_percentage ?? null
  const interests = details?.interests?.length
    ? details.interests
    : profile.interests ?? []
  const socialLinks = mergeProfileSocialLinks(profile, details?.socialLinks)

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
          <AboutSection profile={profile} isOwnProfile={isOwnProfile} />

          {detailsLoading && !details ? (
            <SectionCard title="Background">
              <YStack paddingVertical="$6" alignItems="center">
                <Spinner size="large" />
              </YStack>
            </SectionCard>
          ) : (
            <>
              <ExperienceSection
                items={details?.experiences ?? []}
                isOwnProfile={isOwnProfile}
              />
              <EducationSection items={details?.education ?? []} isOwnProfile={isOwnProfile} />
              <SkillsSection items={details?.skills ?? []} isOwnProfile={isOwnProfile} />
              <LanguagesSection items={details?.languages ?? []} isOwnProfile={isOwnProfile} />
              <InterestsSection items={interests} isOwnProfile={isOwnProfile} />
            </>
          )}

          <ActivitySection posts={posts} postsLoading={postsLoading} isOwnProfile={isOwnProfile} />
          {sidebarFooter}
        </YStack>

        {isSideBySide ? profileRail : null}
      </XStack>
    </YStack>
  )
}

function ProfileHero({
  profile,
  displayName,
  connectionsCount,
  headerActions,
  isOwnProfile,
}: {
  profile: ProfileDisplay
  displayName: string
  connectionsCount: number
  headerActions?: ReactNode
  isOwnProfile: boolean
}) {
  const ui = useAppUi()

  return (
    <YStack
      backgroundColor={ui.surface}
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.border}
      overflow="hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
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
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
          />
          {headerActions ? (
            <XStack
              gap="$2"
              flexWrap="wrap"
              paddingTop="$2"
              alignItems="center"
              flex={1}
              justifyContent="flex-end"
              minWidth={0}
            >
              {headerActions}
            </XStack>
          ) : null}
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
              <Link
                href={
                  isOwnProfile
                    ? communityRoutes.peopleTab('connections')
                    : communityRoutes.userConnections(profile.username)
                }
              >
                <Text fontSize={14} fontWeight="600" color={BRAND_BLUE}>
                  {connectionsCount} connection{connectionsCount === 1 ? '' : 's'}
                </Text>
              </Link>
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
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.border}
      padding="$4"
      gap="$3"
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
      <Link href={communityRoutes.settings}>
        <Text fontSize={14} fontWeight="600" color={BRAND_BLUE}>
          Complete your profile
        </Text>
      </Link>
    </YStack>
  )
}

function AboutSection({
  profile,
  isOwnProfile,
}: {
  profile: ProfileDisplay
  isOwnProfile: boolean
}) {
  const ui = useAppUi()
  const hasContent =
    profile.bio || profile.occupation || profile.business_name || profile.industry

  if (!hasContent && !isOwnProfile) return null

  if (!hasContent && isOwnProfile) {
    return (
      <SectionCard
        title="About"
        icon={Icons.User}
        emptyMessage="Write a short summary about your background, mission, or business."
        emptyAction={
          <Link href={communityRoutes.settings}>
            <Text fontSize={14} fontWeight="600" color={BRAND_BLUE}>
              Add about section
            </Text>
          </Link>
        }
      />
    )
  }

  return (
    <SectionCard title="About" icon={Icons.User}>
      <YStack gap="$2">
        {profile.business_name ? (
          <Text fontSize={16} fontWeight="700" color={ui.text}>
            {profile.business_name}
          </Text>
        ) : null}
        {profile.occupation ? (
          <Text fontSize={15} color={ui.textSecondary} fontWeight="500">
            {profile.occupation}
          </Text>
        ) : null}
        {profile.bio ? (
          <Paragraph fontSize={15} color={ui.text} lineHeight={24} whiteSpace="pre-wrap">
            {profile.bio}
          </Paragraph>
        ) : null}
      </YStack>
    </SectionCard>
  )
}

function ExperienceSection({
  items,
  isOwnProfile,
}: {
  items: ProfileExperience[]
  isOwnProfile: boolean
}) {
  if (items.length === 0 && !isOwnProfile) return null

  return (
    <SectionCard
      title="Experience"
      icon={Icons.Briefcase}
      emptyMessage={
        isOwnProfile
          ? 'Share your work history so others can learn about your career.'
          : undefined
      }
      emptyAction={
        isOwnProfile ? (
          <Link href={communityRoutes.settings}>
            <Text fontSize={14} fontWeight="600" color={BRAND_BLUE}>
              Add experience
            </Text>
          </Link>
        ) : undefined
      }
    >
      {items.length > 0 ? (
        <YStack gap="$0">
          {items.map((item, index) => (
            <YStack key={item.id}>
              <ExperienceRow item={item} />
              {index < items.length - 1 ? <Separator marginVertical="$4" /> : null}
            </YStack>
          ))}
        </YStack>
      ) : null}
    </SectionCard>
  )
}

function ExperienceRow({ item }: { item: ProfileExperience }) {
  const ui = useAppUi()
  const dateRange = formatExperienceDateRange(item.start_date, item.end_date, item.is_current)
  const duration = formatDurationMonths(item.start_date, item.end_date, item.is_current)
  const skillTags = parseSkillTags(item.skills)
  const company = item.company_name || 'Company'
  const title = item.title || 'Role'

  return (
    <XStack gap="$3" alignItems="flex-start">
      <OrgAvatar name={company} />
      <YStack flex={1} gap="$1.5" minWidth={0}>
        <Text fontSize={16} fontWeight="700" color={ui.text}>
          {title}
        </Text>
        <Text fontSize={15} color={ui.text} fontWeight="500">
          {company}
          {item.employment_type ? ` · ${item.employment_type}` : ''}
        </Text>
        {dateRange ? (
          <Text fontSize={13} color={ui.textMuted}>
            {dateRange}
            {duration ? ` · ${duration}` : ''}
          </Text>
        ) : null}
        {item.location ? (
          <XStack gap={4} alignItems="center">
            <Icons.MapPin size={13} color={ui.textMuted} />
            <Text fontSize={13} color={ui.textMuted}>
              {item.location}
              {item.location_type ? ` (${item.location_type})` : ''}
            </Text>
          </XStack>
        ) : null}
        {item.description ? (
          <Paragraph fontSize={14} color={ui.textSecondary} lineHeight={22} marginTop="$1">
            {item.description}
          </Paragraph>
        ) : null}
        {skillTags.length > 0 ? (
          <XStack gap="$2" flexWrap="wrap" marginTop="$2">
            {skillTags.map((tag) => (
              <SkillChip key={tag} label={tag} />
            ))}
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  )
}

function EducationSection({
  items,
  isOwnProfile,
}: {
  items: ProfileEducation[]
  isOwnProfile: boolean
}) {
  if (items.length === 0 && !isOwnProfile) return null

  return (
    <SectionCard
      title="Education"
      icon={Icons.GraduationCap}
      emptyMessage={
        isOwnProfile ? 'Add schools, degrees, and fields of study.' : undefined
      }
      emptyAction={
        isOwnProfile ? (
          <Link href={communityRoutes.settings}>
            <Text fontSize={14} fontWeight="600" color={BRAND_BLUE}>
              Add education
            </Text>
          </Link>
        ) : undefined
      }
    >
      {items.length > 0 ? (
        <YStack gap="$0">
          {items.map((item, index) => (
            <YStack key={item.id}>
              <EducationRow item={item} />
              {index < items.length - 1 ? <Separator marginVertical="$4" /> : null}
            </YStack>
          ))}
        </YStack>
      ) : null}
    </SectionCard>
  )
}

function EducationRow({ item }: { item: ProfileEducation }) {
  const ui = useAppUi()
  const dateRange = formatEducationYearRange(item.start_year, item.end_year)
  const subtitle = [item.degree, item.field_of_study].filter(Boolean).join(', ')
  const skillTags = parseSkillTags(item.skills)

  return (
    <XStack gap="$3" alignItems="flex-start">
      {item.school_logo_url ? (
        <YStack
          width={48}
          height={48}
          borderRadius={8}
          overflow="hidden"
          backgroundColor={ui.surfaceMuted}
        >
          <Image src={item.school_logo_url} width={48} height={48} objectFit="cover" alt="" />
        </YStack>
      ) : (
        <OrgAvatar name={item.school} />
      )}
      <YStack flex={1} gap="$1.5" minWidth={0}>
        <Text fontSize={16} fontWeight="700" color={ui.text}>
          {item.school}
        </Text>
        {subtitle ? (
          <Text fontSize={15} color={ui.text} fontWeight="500">
            {subtitle}
          </Text>
        ) : null}
        {dateRange ? (
          <Text fontSize={13} color={ui.textMuted}>
            {dateRange}
          </Text>
        ) : null}
        {item.grade ? (
          <Text fontSize={13} color={ui.textMuted}>
            Grade: {item.grade}
          </Text>
        ) : null}
        {item.activities ? (
          <Text fontSize={14} color={ui.textSecondary} lineHeight={20}>
            {item.activities}
          </Text>
        ) : null}
        {item.description ? (
          <Paragraph fontSize={14} color={ui.textSecondary} lineHeight={22}>
            {item.description}
          </Paragraph>
        ) : null}
        {skillTags.length > 0 ? (
          <XStack gap="$2" flexWrap="wrap" marginTop="$2">
            {skillTags.map((tag) => (
              <SkillChip key={tag} label={tag} />
            ))}
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  )
}

function SkillsSection({
  items,
  isOwnProfile,
}: {
  items: ProfileSkill[]
  isOwnProfile: boolean
}) {
  if (items.length === 0 && !isOwnProfile) return null

  return (
    <SectionCard
      title="Skills"
      icon={Icons.Sparkles}
      emptyMessage={isOwnProfile ? 'Highlight skills you want to be known for.' : undefined}
      emptyAction={
        isOwnProfile ? (
          <Link href={communityRoutes.settings}>
            <Text fontSize={14} fontWeight="600" color={BRAND_BLUE}>
              Add skills
            </Text>
          </Link>
        ) : undefined
      }
    >
      {items.length > 0 ? (
        <YStack gap="$3">
          {items.map((skill) => (
            <SkillRow key={skill.id} skill={skill} />
          ))}
        </YStack>
      ) : null}
    </SectionCard>
  )
}

function SkillRow({ skill }: { skill: ProfileSkill }) {
  const ui = useAppUi()
  const endorsements = skill.endorsements_count ?? 0
  const meta = [
    skill.proficiency_level,
    skill.years_of_experience != null ? `${skill.years_of_experience}+ yrs` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <YStack gap="$1">
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <Text fontSize={15} fontWeight="600" color={ui.text}>
          {skill.skill_name}
        </Text>
        {endorsements > 0 ? (
          <Text fontSize={13} color={ui.textMuted}>
            {endorsements} endorsement{endorsements === 1 ? '' : 's'}
          </Text>
        ) : null}
      </XStack>
      {meta ? (
        <Text fontSize={13} color={ui.textMuted}>
          {meta}
        </Text>
      ) : null}
    </YStack>
  )
}

function LanguagesSection({
  items,
  isOwnProfile,
}: {
  items: ProfileLanguage[]
  isOwnProfile: boolean
}) {
  if (items.length === 0 && !isOwnProfile) return null

  return (
    <SectionCard
      title="Languages"
      icon={Icons.Globe}
      emptyMessage={isOwnProfile ? 'Add languages you speak or write.' : undefined}
      emptyAction={
        isOwnProfile ? (
          <Link href={communityRoutes.settings}>
            <Text fontSize={14} fontWeight="600" color={BRAND_BLUE}>
              Add languages
            </Text>
          </Link>
        ) : undefined
      }
    >
      {items.length > 0 ? (
        <YStack gap="$3">
          {items.map((language) => (
            <LanguageRow key={language.id} language={language} />
          ))}
        </YStack>
      ) : null}
    </SectionCard>
  )
}

function LanguageRow({ language }: { language: ProfileLanguage }) {
  const ui = useAppUi()

  return (
    <XStack justifyContent="space-between" alignItems="center" gap="$3">
      <Text fontSize={15} fontWeight="600" color={ui.text}>
        {language.language_name}
      </Text>
      {language.proficiency ? (
        <Text fontSize={13} color={ui.textMuted}>
          {language.proficiency}
        </Text>
      ) : null}
    </XStack>
  )
}

function InterestsSection({
  items,
  isOwnProfile,
}: {
  items: string[]
  isOwnProfile: boolean
}) {
  if (items.length === 0 && !isOwnProfile) return null

  return (
    <SectionCard
      title="Interests"
      icon={Icons.Heart}
      emptyMessage={isOwnProfile ? 'Add topics you care about to personalize your feed.' : undefined}
      emptyAction={
        isOwnProfile ? (
          <Link href={communityRoutes.settings}>
            <Text fontSize={14} fontWeight="600" color={BRAND_BLUE}>
              Add interests
            </Text>
          </Link>
        ) : undefined
      }
    >
      {items.length > 0 ? (
        <XStack gap="$2" flexWrap="wrap">
          {items.map((interest) => (
            <InterestChip key={interest} label={interest} />
          ))}
        </XStack>
      ) : null}
    </SectionCard>
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
}: {
  profile: ProfileDisplay
  connectionsCount: number
  isOwnProfile: boolean
}) {
  return (
    <SectionCard title="Profile stats" icon={Icons.BarChart3}>
      <YStack gap="$3">
        <StatRow
          label="Followers"
          value={profile.follower_count ?? 0}
          href={
            isOwnProfile
              ? communityRoutes.peopleTab('followers')
              : communityRoutes.userFollowers(profile.username)
          }
        />
        <StatRow
          label="Following"
          value={profile.following_count ?? 0}
          href={
            isOwnProfile
              ? communityRoutes.peopleTab('following')
              : communityRoutes.userFollowing(profile.username)
          }
        />
        <StatRow
          label="Connections"
          value={connectionsCount}
          href={
            isOwnProfile
              ? communityRoutes.peopleTab('connections')
              : communityRoutes.userConnections(profile.username)
          }
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
    socialLinks.linkedinUrl ? { href: socialLinks.linkedinUrl, label: 'LinkedIn' } : null,
    socialLinks.instagramUrl ? { href: socialLinks.instagramUrl, label: 'Instagram' } : null,
    socialLinks.twitterUrl ? { href: socialLinks.twitterUrl, label: 'Twitter / X' } : null,
    socialLinks.youtubeUrl ? { href: socialLinks.youtubeUrl, label: 'YouTube' } : null,
    socialLinks.githubUrl ? { href: socialLinks.githubUrl, label: 'GitHub' } : null,
    socialLinks.facebookUrl ? { href: socialLinks.facebookUrl, label: 'Facebook' } : null,
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
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.border}
      padding="$4"
      gap="$3"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <XStack gap="$2" alignItems="center">
        {Icon ? <Icon size={20} color={BRAND_BLUE} /> : null}
        <Text fontSize={18} fontWeight="700" color={ui.text} letterSpacing={-0.2}>
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

function OrgAvatar({ name }: { name: string }) {
  const ui = useAppUi()

  return (
    <YStack
      width={48}
      height={48}
      borderRadius={8}
      backgroundColor={ui.surfaceMuted}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      borderWidth={1}
      borderColor={ui.border}
    >
      <Text fontSize={18} fontWeight="700" color={ui.textSecondary}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </YStack>
  )
}

function SkillChip({ label }: { label: string }) {
  const ui = useAppUi()

  return (
    <XStack
      paddingHorizontal="$2.5"
      paddingVertical={4}
      borderRadius={999}
      backgroundColor={ui.surfaceMuted}
      borderWidth={1}
      borderColor={ui.border}
    >
      <Text fontSize={12} fontWeight="600" color={ui.textSecondary}>
        {label}
      </Text>
    </XStack>
  )
}

function InterestChip({ label }: { label: string }) {
  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical={6}
      borderRadius={999}
      backgroundColor="rgba(10, 102, 194, 0.08)"
      borderWidth={1}
      borderColor="rgba(10, 102, 194, 0.2)"
    >
      <Text fontSize={13} fontWeight="600" color={BRAND_BLUE}>
        {label}
      </Text>
    </XStack>
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
  href,
}: {
  label: string
  value: number
  href?: string
}) {
  const ui = useAppUi()

  const row = (
    <XStack justifyContent="space-between" alignItems="center">
      <Text fontSize={14} color={ui.textMuted}>
        {label}
      </Text>
      <Text fontSize={16} fontWeight="700" color={href && value > 0 ? BRAND_BLUE : ui.text}>
        {value}
      </Text>
    </XStack>
  )

  if (!href || value === 0) return row

  return (
    <Link href={href as never}>
      <XStack
        justifyContent="space-between"
        alignItems="center"
        cursor="pointer"
        hoverStyle={{ opacity: 0.85 }}
      >
        <Text fontSize={14} color={ui.textMuted}>
          {label}
        </Text>
        <Text fontSize={16} fontWeight="700" color={BRAND_BLUE}>
          {value}
        </Text>
      </XStack>
    </Link>
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