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
import { YStack } from '~/components/ui'

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
        <ForYouSlot id={FOR_YOU_SLOT.celebrations}>
          <TodayCelebrationsCard />
        </ForYouSlot>
        <ForYouSlot id={FOR_YOU_SLOT.profileCompletion}>
          <ProfileCompletionRevisitStrip />
        </ForYouSlot>
        <ForYouSlot id={FOR_YOU_SLOT.composeDraft}>
          <ComposeDraftRevisitStrip />
        </ForYouSlot>
        <ForYouSlot id={FOR_YOU_SLOT.networkInvitations}>
          <NetworkInvitationsStrip />
        </ForYouSlot>
        <ForYouSlot id={FOR_YOU_SLOT.networkSent}>
          <NetworkSentRevisitStrip />
        </ForYouSlot>
        <ForYouSlot id={FOR_YOU_SLOT.unreadChat}>
          <UnreadChatRevisitStrip />
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
        <ForYouSlot id={FOR_YOU_SLOT.wishlistActivity}>
          <WishlistActivityStrip />
        </ForYouSlot>
        <ForYouSlot id={FOR_YOU_SLOT.recentlyViewed}>
          <CommunityRecentlyViewedStrip />
        </ForYouSlot>
        <ForYouSlot id={FOR_YOU_SLOT.hashtags}>
          <HashtagRevisitStrip />
        </ForYouSlot>
      </CommunityForYouHub>
    ),
    [],
  )

  return (
    <YStack gap="$3" width="100%" paddingBottom="$2">
      <StoriesStrip />
      {forYou}
      <FeedComposer />
      <FeedFilterChips value={contentFilter} onChange={onContentFilterChange} />
      <FeedSortBar value={sort} onChange={onSortChange} />
    </YStack>
  )
}
