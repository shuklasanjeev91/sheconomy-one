import { useMemo } from 'react'

import { CommunityForYouHub } from '~/community/components/CommunityForYouHub'
import { CommunityRecentlyViewedStrip } from '~/community/components/CommunityRecentlyViewedStrip'
import { EventRevisitStrip } from '~/community/components/EventRevisitStrip'
import { FollowedShopActivityStrip } from '~/community/components/FollowedShopActivityStrip'
import { HashtagRevisitStrip } from '~/community/components/HashtagRevisitStrip'
import { IntroductionInboxStrip } from '~/community/components/IntroductionInboxStrip'
import { JobRevisitStrip } from '~/community/components/JobRevisitStrip'
import { NetworkInvitationsStrip } from '~/community/components/NetworkInvitationsStrip'
import { NetworkSuggestionsStrip } from '~/community/components/NetworkSuggestionsStrip'
import { PickUpAgainStrip } from '~/community/components/PickUpAgainStrip'
import { ProfessionalSpotlightStrip } from '~/community/components/ProfessionalSpotlightStrip'
import { ProfileViewersStrip } from '~/community/components/ProfileViewersStrip'
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
        <ProfileViewersStrip />
        <PickUpAgainStrip />
        <EventRevisitStrip />
        <JobRevisitStrip />
        <ProfessionalSpotlightStrip />
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
