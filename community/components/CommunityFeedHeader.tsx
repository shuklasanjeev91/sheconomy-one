import { useMemo } from 'react'

import { CompaniesRevisitStrip } from '~/community/components/CompaniesRevisitStrip'
import { CommunityForYouHub } from '~/community/components/CommunityForYouHub'
import { CommunityRecentlyViewedStrip } from '~/community/components/CommunityRecentlyViewedStrip'
import { CreatorSpotlightStrip } from '~/community/components/CreatorSpotlightStrip'
import { EventRevisitStrip } from '~/community/components/EventRevisitStrip'
import { FollowedShopActivityStrip } from '~/community/components/FollowedShopActivityStrip'
import { GroupsRevisitStrip } from '~/community/components/GroupsRevisitStrip'
import { HashtagRevisitStrip } from '~/community/components/HashtagRevisitStrip'
import { IntroductionInboxStrip } from '~/community/components/IntroductionInboxStrip'
import { JobApplicationsRevisitStrip } from '~/community/components/JobApplicationsRevisitStrip'
import { JobRevisitStrip } from '~/community/components/JobRevisitStrip'
import { MeetingInvitesRevisitStrip } from '~/community/components/MeetingInvitesRevisitStrip'
import { MeetingRevisitStrip } from '~/community/components/MeetingRevisitStrip'
import { NetworkInvitationsStrip } from '~/community/components/NetworkInvitationsStrip'
import { NetworkSuggestionsStrip } from '~/community/components/NetworkSuggestionsStrip'
import { PickUpAgainStrip } from '~/community/components/PickUpAgainStrip'
import { ProfessionalSpotlightStrip } from '~/community/components/ProfessionalSpotlightStrip'
import { ProgramsRevisitStrip } from '~/community/components/ProgramsRevisitStrip'
import { ProfileViewersStrip } from '~/community/components/ProfileViewersStrip'
import { RecommendationInboxStrip } from '~/community/components/RecommendationInboxStrip'
import { StoriesStrip } from '~/community/components/StoriesStrip'
import { TodayCelebrationsCard } from '~/community/components/TodayCelebrationsCard'
import { WishlistActivityStrip } from '~/community/components/WishlistActivityStrip'
import { FeedComposer } from '~/community/components/FeedComposer'
import { FeedFilterChips } from '~/community/components/FeedFilterChips'
import { FeedSortBar, type FeedSort } from '~/community/components/FeedSortBar'
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
        <TodayCelebrationsCard />
        <NetworkInvitationsStrip />
        <NetworkSuggestionsStrip />
        <IntroductionInboxStrip />
        <RecommendationInboxStrip />
        <ProfileViewersStrip />
        <MeetingInvitesRevisitStrip />
        <MeetingRevisitStrip />
        <GroupsRevisitStrip />
        <CompaniesRevisitStrip />
        <ProgramsRevisitStrip />
        <PickUpAgainStrip />
        <EventRevisitStrip />
        <JobRevisitStrip />
        <JobApplicationsRevisitStrip />
        <ProfessionalSpotlightStrip />
        <CreatorSpotlightStrip />
        <FollowedShopActivityStrip />
        <WishlistActivityStrip />
        <CommunityRecentlyViewedStrip />
        <HashtagRevisitStrip />
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
