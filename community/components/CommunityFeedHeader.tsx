import { useMemo } from 'react'

import { CompaniesRevisitStrip } from '~/community/components/CompaniesRevisitStrip'
import { CommunityForYouHub } from '~/community/components/CommunityForYouHub'
import { CommunityRecentlyViewedStrip } from '~/community/components/CommunityRecentlyViewedStrip'
import { CreatorSpotlightStrip } from '~/community/components/CreatorSpotlightStrip'
import { EventRevisitStrip } from '~/community/components/EventRevisitStrip'
import { FollowedShopActivityStrip } from '~/community/components/FollowedShopActivityStrip'
import { ForYouSlot } from '~/community/components/ForYouSlot'
import { GroupsRevisitStrip } from '~/community/components/GroupsRevisitStrip'
import { HashtagRevisitStrip } from '~/community/components/HashtagRevisitStrip'
import { IntroductionInboxStrip } from '~/community/components/IntroductionInboxStrip'
import { IntroductionSentRevisitStrip } from '~/community/components/IntroductionSentRevisitStrip'
import { JobApplicationsRevisitStrip } from '~/community/components/JobApplicationsRevisitStrip'
import { JobRevisitStrip } from '~/community/components/JobRevisitStrip'
import { MeetingInvitesRevisitStrip } from '~/community/components/MeetingInvitesRevisitStrip'
import { MeetingRevisitStrip } from '~/community/components/MeetingRevisitStrip'
import { NetworkInvitationsStrip } from '~/community/components/NetworkInvitationsStrip'
import { NetworkSentRevisitStrip } from '~/community/components/NetworkSentRevisitStrip'
import { NetworkSuggestionsStrip } from '~/community/components/NetworkSuggestionsStrip'
import { ComposeDraftRevisitStrip } from '~/community/components/ComposeDraftRevisitStrip'
import { CreatorModeRevisitStrip } from '~/community/components/CreatorModeRevisitStrip'
import { OpenToServicesRevisitStrip } from '~/community/components/OpenToServicesRevisitStrip'
import { OpenToWorkRevisitStrip } from '~/community/components/OpenToWorkRevisitStrip'
import { PickUpAgainStrip } from '~/community/components/PickUpAgainStrip'
import { ProfessionalSpotlightStrip } from '~/community/components/ProfessionalSpotlightStrip'
import { ProgramsRevisitStrip } from '~/community/components/ProgramsRevisitStrip'
import { ProfileViewersStrip } from '~/community/components/ProfileViewersStrip'
import { ReadLaterRevisitStrip } from '~/community/components/ReadLaterRevisitStrip'
import { SavedCollectionRevisitStrip } from '~/community/components/SavedCollectionRevisitStrip'
import { SavedNotesRevisitStrip } from '~/community/components/SavedNotesRevisitStrip'
import { ShoppablePostsSpotlightStrip } from '~/community/components/ShoppablePostsSpotlightStrip'
import { ProfileCompletionRevisitStrip } from '~/community/components/ProfileCompletionRevisitStrip'
import { RecommendationInboxStrip } from '~/community/components/RecommendationInboxStrip'
import { RecommendationSentRevisitStrip } from '~/community/components/RecommendationSentRevisitStrip'
import { StoriesStrip } from '~/community/components/StoriesStrip'
import { TodayCelebrationsCard } from '~/community/components/TodayCelebrationsCard'
import { UnreadChatRevisitStrip } from '~/community/components/UnreadChatRevisitStrip'
import { WishlistActivityStrip } from '~/community/components/WishlistActivityStrip'
import { FeedComposer } from '~/community/components/FeedComposer'
import { FeedFilterChips } from '~/community/components/FeedFilterChips'
import { FeedSortBar, type FeedSort } from '~/community/components/FeedSortBar'
import { FOR_YOU_SLOT } from '~/community/lib/for-you-density'
import type { FeedContentFilter } from '~/community/lib/community'
import { IdleMount } from '~/components/IdleMount'
import { AppLink } from '~/components/navigation/AppLink'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useProfile } from '~/hooks/useProfile'
import { communityRoutes } from '~/lib/routes'
import { useCommunityUi } from '~/community/lib/community-theme'

type CommunityFeedHeaderProps = {
  contentFilter: FeedContentFilter | null
  sort: FeedSort
  onContentFilterChange: (value: FeedContentFilter | null) => void
  onSortChange: (value: FeedSort) => void
}

export function CommunityFeedHeader({
  contentFilter,
  sort,
  onContentFilterChange,
  onSortChange,
}: CommunityFeedHeaderProps) {
  const forYou = useMemo(
    () => (
      <CommunityForYouHub>
        <IdleMount timeoutMs={0}>
          <ForYouSlot id={FOR_YOU_SLOT.celebrations}>
            <TodayCelebrationsCard />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.profileCompletion}>
            <ProfileCompletionRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.networkInvitations}>
            <NetworkInvitationsStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.unreadChat}>
            <UnreadChatRevisitStrip />
          </ForYouSlot>
        </IdleMount>
        <IdleMount timeoutMs={150}>
          <ForYouSlot id={FOR_YOU_SLOT.composeDraft}>
            <ComposeDraftRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.networkSent}>
            <NetworkSentRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.networkSuggestions}>
            <NetworkSuggestionsStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.introductionInbox}>
            <IntroductionInboxStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.introductionSent}>
            <IntroductionSentRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.recommendationInbox}>
            <RecommendationInboxStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.recommendationSent}>
            <RecommendationSentRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.profileViewers}>
            <ProfileViewersStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.meetingInvites}>
            <MeetingInvitesRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.meetingRevisit}>
            <MeetingRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.groups}>
            <GroupsRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.companies}>
            <CompaniesRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.programs}>
            <ProgramsRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.pickUpAgain}>
            <PickUpAgainStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.readLater}>
            <ReadLaterRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.savedNotes}>
            <SavedNotesRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.savedCollection}>
            <SavedCollectionRevisitStrip />
          </ForYouSlot>
        </IdleMount>
        <IdleMount timeoutMs={400}>
          <ForYouSlot id={FOR_YOU_SLOT.events}>
            <EventRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.jobs}>
            <JobRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.openToWork}>
            <OpenToWorkRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.openToServices}>
            <OpenToServicesRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.jobApplications}>
            <JobApplicationsRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.professionalSpotlight}>
            <ProfessionalSpotlightStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.creatorMode}>
            <CreatorModeRevisitStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.creatorSpotlight}>
            <CreatorSpotlightStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.followedShopActivity}>
            <FollowedShopActivityStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.shoppablePostsSpotlight}>
            <ShoppablePostsSpotlightStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.wishlistActivity}>
            <WishlistActivityStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.recentlyViewed}>
            <CommunityRecentlyViewedStrip />
          </ForYouSlot>
          <ForYouSlot id={FOR_YOU_SLOT.hashtags}>
            <HashtagRevisitStrip />
          </ForYouSlot>
        </IdleMount>
      </CommunityForYouHub>
    ),
    [],
  )

  return (
    <YStack gap="$3" width="100%" paddingBottom="$2">
      <StoriesStrip />
      {forYou}
      <FeedComposer />
      <NativeAdsManagerEntry />
      <FeedFilterChips value={contentFilter} onChange={onContentFilterChange} />
      <FeedSortBar value={sort} onChange={onSortChange} />
    </YStack>
  )
}

function NativeAdsManagerEntry() {
  const communityUi = useCommunityUi()
  const { hasSideRails } = useAppLayout()
  const { isAuthenticated } = useProfile()
  if (hasSideRails || !isAuthenticated) return null

  return (
    <AppLink href={communityRoutes.ads} asChild>
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$3"
        padding="$3"
        borderRadius="$4"
        borderWidth={1}
        borderColor={communityUi.border}
        backgroundColor={communityUi.cardBg}
        cursor="pointer"
      >
        <XStack alignItems="center" gap="$3" flex={1} minWidth={0}>
          <Icons.Megaphone size={18} color={communityUi.brand} />
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={14} fontWeight="700" color={communityUi.text}>
              Ads Manager
            </Text>
            <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
              Boost posts, track results, pause or resume campaigns
            </Text>
          </YStack>
        </XStack>
        <Text fontSize={13} fontWeight="700" color={communityUi.brand}>
          Open
        </Text>
      </XStack>
    </AppLink>
  )
}
