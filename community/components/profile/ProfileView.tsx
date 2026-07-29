import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { UserListBottomSheet } from '~/community/components/UserListBottomSheet'
import { ProfileBackgroundSections } from '~/community/components/profile/ProfileBackgroundSections'
import { FeaturedPostsSection } from '~/community/components/profile/FeaturedPostsSection'
import { RecommendationsSection } from '~/community/components/profile/RecommendationsSection'
import { WhoViewedYourProfileCard } from '~/community/components/profile/WhoViewedYourProfileCard'
import type { ProfileDisplay } from '~/community/components/profile/types'
import { AppLink } from '~/components/navigation/AppLink'
import { useProfileDetails } from '~/community/hooks/useProfileDetails'
import { useUserActivity } from '~/community/hooks/useUserActivity'
import { BRAND_BLUE } from '~/community/lib/constants'
import { brandColors } from '~/config/brand-colors'
import type { CommunityPost } from '~/community/lib/community'
import {
  parseCreatorMode,
  saveCreatorMode,
  type CreatorModePrefs,
} from '~/community/lib/creator-mode'
import {
  parseOpenToServices,
  saveOpenToServices,
  type OpenToServicesPrefs,
} from '~/community/lib/open-to-services'
import {
  parseOpenToWork,
  saveOpenToWork,
  type OpenToWorkPrefs,
} from '~/community/lib/open-to-work'
import {
  fetchProfileAnalytics,
  type ProfileAnalytics,
} from '~/community/lib/profile-views'
import type {
  ActivityComment,
  ActivityFilter,
  ActivityReaction,
} from '~/community/lib/user-activity'
import { mergeProfileSocialLinks } from '~/community/lib/profile-details'
import { htmlToPlainText } from '~/community/lib/post-text'
import {
  fetchProfileNetworkCounts,
  type UserListKind,
} from '~/community/lib/user-lists'
import {
  Avatar,
  Badge,
  Button,
  Icons,
  Image,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
  useMedia,
} from '~/components/ui'
import { ShareButton } from '~/components/share'
import { updateProfileImages } from '~/community/lib/profile-sections'
import { readPickedImageBytes, type PickedImage } from '~/lib/media/pick-image'
import { cropIfNeeded, pickImagesWithCrop } from '~/lib/media/pick-and-crop'
import { refreshProfiles } from '~/lib/profile/refresh'
import { patchCachedProfile } from '~/lib/profile/profile-cache'
import { communityRoutes } from '~/lib/routes'
import { getProfileShareUrl } from '~/lib/share'
import { supabase } from '~/lib/supabase/client'
import { uploadProfileAvatarImage, uploadProfileCoverImage } from '~/lib/supabase/storage-upload'
import { MediaDropZone } from '~/components/media/MediaDropZone'
import { UploadProgressBar } from '~/components/media/UploadProgressBar'
import { useUploadProgress } from '~/hooks/useUploadProgress'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

type ProfileHeaderActions =
  | ReactNode
  | ((helpers: { openUserList: (kind: UserListKind) => void }) => ReactNode)

type ProfileViewProps = {
  profile: ProfileDisplay
  isOwnProfile?: boolean
  headerActions?: ProfileHeaderActions
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
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null)
  const [openToWork, setOpenToWork] = useState<OpenToWorkPrefs>({ enabled: false })
  const [openToServices, setOpenToServices] = useState<OpenToServicesPrefs>({ enabled: false })
  const [creatorMode, setCreatorMode] = useState<CreatorModePrefs>({ enabled: false })
  const [jobPreferences, setJobPreferences] = useState<unknown>(null)
  const [savingOpenToWork, setSavingOpenToWork] = useState(false)
  const [savingOpenToServices, setSavingOpenToServices] = useState(false)
  const [savingCreatorMode, setSavingCreatorMode] = useState(false)
  const toast = useAppToast()

  useEffect(() => {
    let active = true
    void supabase
      .from('profiles')
      .select('job_preferences')
      .eq('id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setJobPreferences(data?.job_preferences ?? null)
        setOpenToWork(parseOpenToWork(data?.job_preferences))
        setOpenToServices(parseOpenToServices(data?.job_preferences))
        setCreatorMode(parseCreatorMode(data?.job_preferences))
      })
    return () => {
      active = false
    }
  }, [profile.id])

  useEffect(() => {
    if (!isOwnProfile) {
      setAnalytics(null)
      return
    }
    let active = true
    void fetchProfileAnalytics(profile.id).then((data) => {
      if (active) setAnalytics(data)
    })
    return () => {
      active = false
    }
  }, [isOwnProfile, profile.id])

  async function handleToggleOpenToWork() {
    if (!isOwnProfile || savingOpenToWork) return
    const next = { ...openToWork, enabled: !openToWork.enabled }
    setSavingOpenToWork(true)
    const { error } = await saveOpenToWork(profile.id, next, jobPreferences)
    setSavingOpenToWork(false)
    if (error) {
      toast.show('Could not update Open to work', { tone: 'danger', message: error })
      return
    }
    setOpenToWork(next)
    setJobPreferences((prev) => {
      const base =
        prev && typeof prev === 'object' && !Array.isArray(prev)
          ? { ...(prev as Record<string, unknown>) }
          : {}
      return {
        ...base,
        open_to_work: {
          enabled: next.enabled,
          title: next.title ?? 'Open to work',
          locations: next.locations ?? [],
          visibility: next.visibility ?? 'public',
        },
      }
    })
    toast.show(next.enabled ? 'Open to work is on' : 'Open to work is off', { tone: 'success' })
  }

  async function handleToggleOpenToServices() {
    if (!isOwnProfile || savingOpenToServices) return
    const next = { ...openToServices, enabled: !openToServices.enabled }
    setSavingOpenToServices(true)
    const { error } = await saveOpenToServices(profile.id, next, jobPreferences)
    setSavingOpenToServices(false)
    if (error) {
      toast.show('Could not update services preference', { tone: 'danger', message: error })
      return
    }
    setOpenToServices(next)
    setJobPreferences((prev) => {
      const base =
        prev && typeof prev === 'object' && !Array.isArray(prev)
          ? { ...(prev as Record<string, unknown>) }
          : {}
      return {
        ...base,
        open_to_services: {
          enabled: next.enabled,
          title: next.title ?? 'Open to providing services',
          categories: next.categories ?? [],
        },
      }
    })
    toast.show(next.enabled ? 'Services flag is on' : 'Services flag is off', { tone: 'success' })
  }

  async function handleToggleCreatorMode() {
    if (!isOwnProfile || savingCreatorMode) return
    const next = { ...creatorMode, enabled: !creatorMode.enabled }
    setSavingCreatorMode(true)
    const { error } = await saveCreatorMode(profile.id, next, jobPreferences)
    setSavingCreatorMode(false)
    if (error) {
      toast.show('Could not update Creator mode', { tone: 'danger', message: error })
      return
    }
    setCreatorMode(next)
    setJobPreferences((prev) => {
      const base =
        prev && typeof prev === 'object' && !Array.isArray(prev)
          ? { ...(prev as Record<string, unknown>) }
          : {}
      return {
        ...base,
        creator_mode: {
          enabled: next.enabled,
          topics: next.topics ?? [],
        },
      }
    })
    toast.show(next.enabled ? 'Creator mode is on' : 'Creator mode is off', { tone: 'success' })
  }

  const displayName = profile.full_name || profile.username
  const [networkCounts, setNetworkCounts] = useState({
    connections: profile.connections_count ?? 0,
    followers: profile.follower_count ?? 0,
    following: profile.following_count ?? 0,
  })
  const connectionsCount = networkCounts.connections
  const completion =
    details?.profileCompletion ?? profile.profile_completion_percentage ?? null
  const interests = details?.interests?.length
    ? details.interests
    : profile.interests ?? []
  const socialLinks = mergeProfileSocialLinks(profile, details?.socialLinks)
  const [listSheetKind, setListSheetKind] = useState<UserListKind | null>(null)
  const [listSheetOpen, setListSheetOpen] = useState(false)

  useEffect(() => {
    let active = true
    setNetworkCounts({
      connections: profile.connections_count ?? 0,
      followers: profile.follower_count ?? 0,
      following: profile.following_count ?? 0,
    })
    void fetchProfileNetworkCounts(profile.id).then((counts) => {
      if (!active) return
      setNetworkCounts(counts)
    })
    return () => {
      active = false
    }
  }, [
    profile.id,
    profile.connections_count,
    profile.follower_count,
    profile.following_count,
  ])

  function openUserList(kind: UserListKind) {
    setListSheetKind(kind)
    setListSheetOpen(true)
  }

  const resolvedHeaderActions =
    typeof headerActions === 'function' ? headerActions({ openUserList }) : headerActions

  const profileRail = (
    <YStack
      width={isSideBySide ? 300 : '100%'}
      maxWidth="100%"
      flexShrink={0}
      gap="$4"
    >
      <StatsSidebar
        connectionsCount={connectionsCount}
        followersCount={networkCounts.followers}
        followingCount={networkCounts.following}
        isOwnProfile={isOwnProfile}
        analytics={analytics}
        onOpenList={openUserList}
      />
      {isOwnProfile ? (
        <WhoViewedYourProfileCard
          profileUserId={profile.id}
          viewsCount={analytics?.profileViewsLast30Days}
        />
      ) : null}
      {isOwnProfile ? (
        <OpenToWorkCard
          prefs={openToWork}
          saving={savingOpenToWork}
          onToggle={() => void handleToggleOpenToWork()}
        />
      ) : null}
      {isOwnProfile ? (
        <OpenToServicesCard
          prefs={openToServices}
          saving={savingOpenToServices}
          onToggle={() => void handleToggleOpenToServices()}
        />
      ) : null}
      {isOwnProfile ? (
        <CreatorModeCard
          prefs={creatorMode}
          saving={savingCreatorMode}
          onToggle={() => void handleToggleCreatorMode()}
        />
      ) : null}
      <LinksSidebar socialLinks={socialLinks} />
    </YStack>
  )

  const mainColumn = (
    <YStack flex={isSideBySide ? 1 : undefined} gap="$4" width="100%" minWidth={0}>
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

      <FeaturedPostsSection profileUserId={profile.id} isOwnProfile={isOwnProfile} />

      <RecommendationsSection
        profileUserId={profile.id}
        profileUsername={profile.username}
        displayName={displayName}
        isOwnProfile={isOwnProfile}
      />

      <ActivitySection userId={profile.id} isOwnProfile={isOwnProfile} displayName={displayName} />
      {sidebarFooter}
    </YStack>
  )

  return (
    <YStack width="100%" gap="$4" paddingBottom="$4">
      <ProfileHero
        profile={profile}
        displayName={displayName}
        connectionsCount={connectionsCount}
        headerActions={resolvedHeaderActions}
        isOwnProfile={isOwnProfile}
        openToWork={openToWork.enabled}
        openToServices={openToServices.enabled}
        creatorMode={creatorMode.enabled}
        onOpenConnections={() => openUserList('connections')}
      />

      {isOwnProfile && completion != null && completion < 100 ? (
        <ProfileCompletionCard percent={completion} />
      ) : null}

      {isSideBySide ? (
        <XStack gap="$4" alignItems="flex-start" width="100%">
          {mainColumn}
          {profileRail}
        </XStack>
      ) : (
        <YStack gap="$4" width="100%">
          {profileRail}
          {mainColumn}
        </YStack>
      )}

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
  openToWork,
  openToServices,
  creatorMode,
  onOpenConnections,
}: {
  profile: ProfileDisplay
  displayName: string
  connectionsCount: number
  headerActions?: ReactNode
  isOwnProfile: boolean
  openToWork: boolean
  openToServices: boolean
  creatorMode: boolean
  onOpenConnections: () => void
}) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  /**
   * Optimistic URL — local file/blob while uploading, then the public URL until
   * `profile.avatar_url` / `cover_url` catch up from useProfile refresh.
   */
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null)
  const [localCoverUrl, setLocalCoverUrl] = useState<string | null>(null)
  const { progress: uploadProgress, track: trackUpload, reset: resetUpload } = useUploadProgress()

  const avatarUrl = localAvatarUrl ?? profile.avatar_url
  const coverUrl = localCoverUrl ?? profile.cover_url

  useEffect(() => {
    if (!localAvatarUrl) return
    const remote = profile.avatar_url?.trim()
    if (!remote) return
    // Only drop the optimistic URL once the signed-in profile has the same
    // remote URL. Do NOT clear just because some other http avatar (e.g. Google
    // social fallback) is already present — that wiped the new photo.
    if (remote === localAvatarUrl.trim()) {
      setLocalAvatarUrl(null)
    }
  }, [profile.avatar_url, localAvatarUrl])

  useEffect(() => {
    if (!localCoverUrl) return
    const remote = profile.cover_url?.trim()
    if (!remote) return
    if (remote === localCoverUrl.trim()) {
      setLocalCoverUrl(null)
    }
  }, [profile.cover_url, localCoverUrl])

  async function handleUploadImage(kind: 'avatar' | 'cover', first: PickedImage) {
    if (!profile.id) return
    const setBusy = kind === 'avatar' ? setUploadingAvatar : setUploadingCover
    const setLocal = kind === 'avatar' ? setLocalAvatarUrl : setLocalCoverUrl
    setBusy(true)
    trackUpload(1)
    // Show the picked photo immediately (before storage finishes).
    if (first.uri) setLocal(first.uri)
    try {
      // Read bytes once — never re-read a RN Blob (second read can be empty while
      // upload still "succeeds" and leaves a public URL that shows as initials).
      const bytes = await readPickedImageBytes(first)
      if (!bytes.byteLength) {
        setLocal(null)
        toast.show('Could not read that image', { tone: 'danger' })
        return
      }
      const upload = kind === 'avatar' ? uploadProfileAvatarImage : uploadProfileCoverImage
      const { data, error } = await upload(
        profile.id,
        {
          arrayBuffer: bytes.buffer,
          mimeType: bytes.mimeType || first.mimeType || 'image/jpeg',
          fileName: first.fileName ?? bytes.fileName,
        },
        { onProgress: trackUpload },
      )
      if (error || !data?.publicUrl) {
        setLocal(null)
        toast.show('Could not upload image', { tone: 'danger', message: error ?? undefined })
        return
      }
      const publicUrl = data.publicUrl
      setLocal(publicUrl)

      const { error: updateError, data: saved } = await updateProfileImages(
        profile.id,
        kind === 'avatar' ? { avatar_url: publicUrl } : { cover_url: publicUrl },
      )
      if (updateError || !saved) {
        setLocal(null)
        toast.show('Could not update photo', { tone: 'danger', message: updateError ?? undefined })
        return
      }

      const nextAvatar =
        kind === 'avatar'
          ? (saved.avatar_url?.trim() || publicUrl)
          : (saved.avatar_url ?? profile.avatar_url)
      const nextCover =
        kind === 'cover'
          ? (saved.cover_url?.trim() || publicUrl)
          : (saved.cover_url ?? profile.cover_url)

      // Keep showing the saved public URL until useProfile catches up.
      if (kind === 'avatar') setLocal(nextAvatar)
      else setLocal(nextCover ?? publicUrl)

      // Keep the signed-in profile cache in sync so tab bar / composer pick up the photo.
      await patchCachedProfile(profile.id, {
        avatar_url: nextAvatar ?? null,
        cover_url: nextCover ?? null,
      })
      toast.show(kind === 'avatar' ? 'Profile photo updated' : 'Cover photo updated', {
        tone: 'success',
      })
      refreshProfiles()
    } catch (err) {
      setLocal(null)
      toast.show('Could not update photo', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
      resetUpload()
    }
  }

  async function handlePickImage(kind: 'avatar' | 'cover') {
    if (!profile.id) return
    const busy = kind === 'avatar' ? uploadingAvatar : uploadingCover
    if (busy) return
    try {
      const picked = await pickImagesWithCrop({
        multiple: false,
        maxCount: 1,
        aspect: kind === 'avatar' ? 'avatar' : 'cover',
        cropTitle: kind === 'avatar' ? 'Profile photo' : 'Cover photo',
      })
      const first = picked[0]
      if (!first) return
      await handleUploadImage(kind, first)
    } catch {
      toast.show('Could not update photo', { tone: 'danger' })
    }
  }

  return (
    <YStack
      backgroundColor={ui.surface}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      overflow="hidden"
      style={getShadowStyle('sm')}
    >
      <MediaDropZone
        disabled={!isOwnProfile || uploadingCover}
        accept="image"
        maxCount={1}
        label="Drop a cover photo"
        onDrop={(items) => {
          const first = items[0]
          if (!first) return
          void (async () => {
            const cropped = await cropIfNeeded(first, 'cover', { cropTitle: 'Cover photo' })
            if (cropped) void handleUploadImage('cover', cropped)
          })()
        }}
      >
        <CoverBanner
          coverUrl={coverUrl}
          editable={isOwnProfile}
          uploading={uploadingCover}
          uploadProgress={uploadingCover ? uploadProgress : null}
          onEdit={() => void handlePickImage('cover')}
        />
      </MediaDropZone>

      <YStack paddingHorizontal="$4" paddingBottom="$4">
        <XStack
          marginTop={-52}
          justifyContent="space-between"
          alignItems="flex-end"
          gap="$3"
          width="100%"
        >
          <MediaDropZone
            disabled={!isOwnProfile || uploadingAvatar}
            accept="image"
            maxCount={1}
            label="Drop a profile photo"
            fill={false}
            borderRadius={999}
            onDrop={(items) => {
              const first = items[0]
              if (!first) return
              void (async () => {
                const cropped = await cropIfNeeded(first, 'avatar', { cropTitle: 'Profile photo' })
                if (cropped) void handleUploadImage('avatar', cropped)
              })()
            }}
          >
          <YStack
            position="relative"
            flexShrink={0}
            cursor={isOwnProfile ? 'pointer' : 'default'}
            onPress={isOwnProfile ? () => void handlePickImage('avatar') : undefined}
          >
            <Avatar
              name={displayName}
              src={avatarUrl ?? undefined}
              size="$10"
              borderWidth={4}
              borderColor={ui.surface}
              style={getShadowStyle('md')}
            />
            {isOwnProfile ? (
              <XStack
                position="absolute"
                bottom={2}
                right={2}
                width={34}
                height={34}
                borderRadius={999}
                backgroundColor={BRAND_BLUE}
                borderWidth={3}
                borderColor={ui.surface}
                alignItems="center"
                justifyContent="center"
              >
                {uploadingAvatar ? (
                  <Spinner size="small" color="white" />
                ) : (
                  <Icons.Camera size={16} color="white" />
                )}
              </XStack>
            ) : null}
          </YStack>
          </MediaDropZone>
        </XStack>

        {uploadingAvatar && uploadProgress != null && uploadProgress > 0 ? (
          <YStack width="100%" maxWidth={280} marginTop="$2">
            <UploadProgressBar progress={uploadProgress} label="Uploading photo…" compact />
          </YStack>
        ) : null}

        {(isOwnProfile || headerActions) ? (
          <XStack
            gap="$2"
            flexWrap="wrap"
            paddingTop="$3"
            alignItems="center"
            width="100%"
            justifyContent="flex-start"
            flexDirection="row"
          >
            {headerActions}
            {isOwnProfile ? (
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
            ) : null}
          </XStack>
        ) : null}

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
            {openToWork ? (
              <Badge tone="success" size="sm">
                Open to work
              </Badge>
            ) : null}
            {openToServices ? (
              <Badge tone="brand" size="sm">
                Providing services
              </Badge>
            ) : null}
            {creatorMode ? (
              <Badge tone="brand" size="sm">
                Creator
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
                hoverStyle={{ opacity: 0.85, textDecorationLine: 'underline' }}
                onPress={onOpenConnections}
                accessibilityRole="link"
              >
                {connectionsCount} connection{connectionsCount === 1 ? '' : 's'}
              </Text>
            ) : isOwnProfile ? (
              <AppLink href={communityRoutes.network}>
                <Text fontSize={14} fontWeight="600" color={BRAND_BLUE}>
                  Grow your network
                </Text>
              </AppLink>
            ) : (
              <Text
                fontSize={14}
                fontWeight="600"
                color={BRAND_BLUE}
                cursor="pointer"
                hoverStyle={{ opacity: 0.85, textDecorationLine: 'underline' }}
                onPress={onOpenConnections}
                accessibilityRole="link"
              >
                Connections
              </Text>
            )}
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

const ACTIVITY_TABS: { key: ActivityFilter; label: string; icon: typeof Icons.Activity }[] = [
  { key: 'posts', label: 'Posts', icon: Icons.FileText },
  { key: 'comments', label: 'Comments', icon: Icons.MessageCircle },
  { key: 'reactions', label: 'Reactions', icon: Icons.ThumbsUp },
]

const REACTION_META: Record<string, { emoji: string; label: string }> = {
  like: { emoji: '👍', label: 'liked' },
  celebrate: { emoji: '👏', label: 'celebrated' },
  support: { emoji: '🤝', label: 'supported' },
  love: { emoji: '❤️', label: 'loved' },
  insightful: { emoji: '💡', label: 'found insightful' },
  funny: { emoji: '😄', label: 'found funny' },
  curious: { emoji: '🤔', label: 'was curious about' },
}

function ActivitySection({
  userId,
  isOwnProfile,
  displayName,
}: {
  userId: string
  isOwnProfile: boolean
  displayName: string
}) {
  const ui = useAppUi()
  const activity = useUserActivity(userId)
  const subject = isOwnProfile ? 'You' : displayName

  const emptyMessage =
    activity.filter === 'posts'
      ? isOwnProfile
        ? 'You have not posted yet. Share an update with your network.'
        : 'No posts yet.'
      : activity.filter === 'comments'
        ? isOwnProfile
          ? 'You have not commented on any posts yet.'
          : 'No comments yet.'
        : isOwnProfile
          ? 'You have not reacted to any posts yet.'
          : 'No reactions yet.'

  return (
    <SectionCard title="Activity" icon={Icons.Activity}>
      <YStack gap="$3">
        <XStack gap="$2" flexWrap="wrap">
          {ACTIVITY_TABS.map((tab) => {
            const active = activity.filter === tab.key
            const TabIcon = tab.icon
            return (
              <XStack
                key={tab.key}
                gap={6}
                alignItems="center"
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderRadius={999}
                borderWidth={1}
                borderColor={active ? BRAND_BLUE : ui.borderSubtle}
                backgroundColor={active ? `${BRAND_BLUE}14` : 'transparent'}
                cursor="pointer"
                hoverStyle={{ opacity: 0.85 }}
                pressStyle={{ opacity: 0.7 }}
                onPress={() => activity.setFilter(tab.key)}
              >
                <TabIcon size={15} color={active ? BRAND_BLUE : ui.textMuted} />
                <Text fontSize={13} fontWeight="600" color={active ? BRAND_BLUE : ui.textMuted}>
                  {tab.label}
                </Text>
              </XStack>
            )
          })}
        </XStack>

        {activity.isLoading ? (
          <YStack paddingVertical="$6" alignItems="center">
            <Spinner size="large" />
          </YStack>
        ) : activity.items.length === 0 ? (
          <YStack gap="$2" paddingVertical="$2">
            <Text color={ui.textMuted}>{emptyMessage}</Text>
            {isOwnProfile && activity.filter === 'posts' ? (
              <AppLink href={communityRoutes.createPost}>
                <Text color={BRAND_BLUE} fontWeight="600">
                  Create a post
                </Text>
              </AppLink>
            ) : null}
          </YStack>
        ) : (
          <YStack gap="$3">
            {activity.filter === 'posts'
              ? (activity.items as CommunityPost[]).map((post) => (
                  <FeedPostCard key={post.id} post={post} />
                ))
              : activity.filter === 'comments'
                ? (activity.items as ActivityComment[]).map((item) => (
                    <ActivityEntry
                      key={item.id}
                      context={`${subject} commented`}
                      quote={htmlToPlainText(item.content)}
                      post={item.post}
                    />
                  ))
                : (activity.items as ActivityReaction[]).map((item) => {
                    const meta = REACTION_META[item.reactionType] ?? {
                      emoji: '👍',
                      label: 'reacted to',
                    }
                    return (
                      <ActivityEntry
                        key={item.id}
                        context={`${meta.emoji} ${subject} ${meta.label} this`}
                        post={item.post}
                      />
                    )
                  })}

            <LoadMoreSentinel
              hasMore={activity.hasMore}
              isLoadingMore={activity.isLoadingMore}
              onLoadMore={() => void activity.loadMore()}
              label="Show more activity"
            />
          </YStack>
        )}
      </YStack>
    </SectionCard>
  )
}

function ActivityEntry({
  context,
  quote,
  post,
}: {
  context: string
  quote?: string
  post: CommunityPost | null
}) {
  const ui = useAppUi()

  return (
    <YStack gap="$2">
      <Text fontSize={13} color={ui.textMuted} fontWeight="500">
        {context}
      </Text>
      {quote ? (
        <Text
          fontSize={14}
          color={ui.text}
          borderLeftWidth={3}
          borderLeftColor={ui.borderSubtle}
          paddingLeft="$3"
        >
          {quote}
        </Text>
      ) : null}
      {post ? (
        <FeedPostCard post={post} />
      ) : (
        <Text fontSize={13} color={ui.textMuted} fontStyle="italic">
          This post is no longer available.
        </Text>
      )}
    </YStack>
  )
}

function StatsSidebar({
  connectionsCount,
  followersCount,
  followingCount,
  isOwnProfile,
  analytics,
  onOpenList,
}: {
  connectionsCount: number
  followersCount: number
  followingCount: number
  isOwnProfile: boolean
  analytics: ProfileAnalytics | null
  onOpenList: (kind: UserListKind) => void
}) {
  return (
    <SectionCard title="Profile stats" icon={Icons.BarChart3}>
      <YStack gap="$3">
        <StatRow
          label="Followers"
          value={followersCount}
          onPress={() => onOpenList('followers')}
        />
        <StatRow
          label="Following"
          value={followingCount}
          onPress={() => onOpenList('following')}
        />
        <StatRow
          label="Connections"
          value={connectionsCount}
          onPress={() => onOpenList('connections')}
        />
        {isOwnProfile && analytics ? (
          <>
            <StatRow label="Profile views (30d)" value={analytics.profileViewsLast30Days} />
            <StatRow label="Unique viewers" value={analytics.uniqueViewersCount} />
          </>
        ) : null}
      </YStack>
    </SectionCard>
  )
}

function OpenToWorkCard({
  prefs,
  saving,
  onToggle,
}: {
  prefs: OpenToWorkPrefs
  saving: boolean
  onToggle: () => void
}) {
  const ui = useAppUi()

  return (
    <SectionCard title="Career preferences" icon={Icons.Briefcase}>
      <YStack gap="$3">
        <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
          Let recruiters and your network know you are open to opportunities.
        </Text>
        <Button
          size="$3"
          tone={prefs.enabled ? 'outline' : 'primary'}
          borderRadius={999}
          disabled={saving}
          onPress={onToggle}
          alignSelf="flex-start"
        >
          {saving ? 'Saving…' : prefs.enabled ? 'Turn off Open to work' : 'Turn on Open to work'}
        </Button>
      </YStack>
    </SectionCard>
  )
}

function OpenToServicesCard({
  prefs,
  saving,
  onToggle,
}: {
  prefs: OpenToServicesPrefs
  saving: boolean
  onToggle: () => void
}) {
  const ui = useAppUi()

  return (
    <SectionCard title="Services" icon={Icons.Handshake}>
      <YStack gap="$3">
        <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
          Show that you offer professional services so clients can find and message you.
        </Text>
        <Button
          size="$3"
          tone={prefs.enabled ? 'outline' : 'primary'}
          borderRadius={999}
          disabled={saving}
          onPress={onToggle}
          alignSelf="flex-start"
        >
          {saving
            ? 'Saving…'
            : prefs.enabled
              ? 'Turn off Providing services'
              : 'Turn on Providing services'}
        </Button>
      </YStack>
    </SectionCard>
  )
}

function CreatorModeCard({
  prefs,
  saving,
  onToggle,
}: {
  prefs: CreatorModePrefs
  saving: boolean
  onToggle: () => void
}) {
  const ui = useAppUi()

  return (
    <SectionCard title="Creator mode" icon={Icons.Sparkles}>
      <YStack gap="$3">
        <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
          Highlight that you publish content. People can follow you and use content-focused icebreakers.
        </Text>
        <Button
          size="$3"
          tone={prefs.enabled ? 'outline' : 'primary'}
          borderRadius={999}
          disabled={saving}
          onPress={onToggle}
          alignSelf="flex-start"
        >
          {saving ? 'Saving…' : prefs.enabled ? 'Turn off Creator mode' : 'Turn on Creator mode'}
        </Button>
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
    <AppLink href={href} external>
      <XStack gap="$2" alignItems="center" cursor="pointer" hoverStyle={{ opacity: 0.85 }}>
        <Icons.ExternalLink size={14} color={BRAND_BLUE} />
        <Text color={BRAND_BLUE} fontSize={14} fontWeight="500" numberOfLines={1}>
          {label}
        </Text>
      </XStack>
    </AppLink>
  )
}

function CoverBanner({
  coverUrl,
  editable = false,
  uploading = false,
  uploadProgress = null,
  onEdit,
}: {
  coverUrl?: string | null
  editable?: boolean
  uploading?: boolean
  uploadProgress?: number | null
  onEdit?: () => void
}) {
  const ui = useAppUi()

  return (
    <YStack height={200} width="100%" position="relative" overflow="hidden">
      {coverUrl ? (
        <YStack height={200} width="100%" backgroundColor={ui.imagePlaceholder}>
          <Image src={coverUrl} width="100%" height={200} objectFit="cover" alt="" />
        </YStack>
      ) : (
        <YStack
          height={200}
          width="100%"
          style={
            Platform.OS === 'web'
              ? {
                  background: `linear-gradient(135deg, ${brandColors.primaryDark} 0%, ${brandColors.primary} 50%, ${brandColors.primaryLight} 100%)`,
                }
              : { backgroundColor: BRAND_BLUE }
          }
        />
      )}

      {editable ? (
        <XStack
          position="absolute"
          top={12}
          right={12}
          width={40}
          height={40}
          borderRadius={999}
          backgroundColor="rgba(0,0,0,0.55)"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          hoverStyle={{ opacity: 0.85 }}
          pressStyle={{ opacity: 0.7 }}
          onPress={onEdit}
          accessibilityLabel="Change cover photo"
        >
          {uploading ? (
            <Spinner size="small" color="white" />
          ) : (
            <Icons.Camera size={18} color="white" />
          )}
        </XStack>
      ) : null}

      {uploadProgress != null && uploadProgress > 0 ? (
        <YStack position="absolute" left={12} right={12} bottom={12}>
          <UploadProgressBar progress={uploadProgress} label="Uploading cover…" compact />
        </YStack>
      ) : null}
    </YStack>
  )
}