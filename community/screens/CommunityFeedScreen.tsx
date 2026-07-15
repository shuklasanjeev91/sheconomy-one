import { useMemo, useState } from 'react'

import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { CommunitySuggestionSectionCard } from '~/community/components/CommunitySuggestionSectionCard'
import { StoriesStrip } from '~/community/components/StoriesStrip'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedComposer } from '~/community/components/FeedComposer'
import { FeedFilterChips } from '~/community/components/FeedFilterChips'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { FeedSortBar, type FeedSort } from '~/community/components/FeedSortBar'
import { CommunityCard } from '~/community/components/CommunityCard'
import { PushPermissionBanner } from '~/components/notifications/PushPermissionBanner'
import type { FeedContentFilter } from '~/community/lib/community'
import { useCommunityFeed } from '~/community/hooks/useCommunityFeed'
import { useCommunitySuggestions } from '~/community/hooks/useCommunitySuggestions'
import { useCommunityUi } from '~/community/lib/community-theme'
import { interleaveFeedWithSuggestions } from '~/community/lib/interleave-feed-suggestions'
import { Spinner, Text, YStack, useMedia } from '~/components/ui'

const SUGGESTION_INTERVAL = 3

export function CommunityFeedScreen() {
  const communityUi = useCommunityUi()
  const [sort, setSort] = useState<FeedSort>('recent')
  const [contentFilter, setContentFilter] = useState<FeedContentFilter | null>(null)
  const media = useMedia()
  const isDesktop = media.gtLg
  const { items, isLoading, isLoadingMore, hasMore, error, loadMore, refresh } = useCommunityFeed(
    true,
    sort,
    contentFilter ?? undefined,
  )
  const { sections } = useCommunitySuggestions(4)

  const feedEntries = useMemo(() => {
    if (isDesktop || !sections.length) {
      return items.map((post) => ({ type: 'post' as const, post }))
    }
    return interleaveFeedWithSuggestions(items, sections, SUGGESTION_INTERVAL)
  }, [isDesktop, items, sections])

  return (
    <CommunityShell>
      <PushPermissionBanner />
      <StoriesStrip />
      {isDesktop ? <FeedComposer /> : null}
      <FeedFilterChips value={contentFilter} onChange={setContentFilter} />
      <FeedSortBar value={sort} onChange={setSort} />

      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      ) : error ? (
        <CommunityCard padding={16}>
          <Text color={communityUi.textMuted}>{error}</Text>
        </CommunityCard>
      ) : items.length === 0 ? (
        <CommunityCard padding={24} alignItems="center" gap={8}>
          <Text fontWeight="600" fontSize={16} color={communityUi.text}>
            Your feed is quiet
          </Text>
          <Text color={communityUi.textMuted} fontSize={14} textAlign="center">
            Be the first to share an update with your network.
          </Text>
        </CommunityCard>
      ) : (
        <>
          {feedEntries.map((entry) => {
            if (entry.type === 'post') {
              return <FeedPostCard key={entry.post.id} post={entry.post} />
            }

            return (
              <CommunitySuggestionSectionCard
                key={`suggestion-${entry.section.kind}-${entry.slot}`}
                section={entry.section}
                limit={3}
              />
            )
          })}
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
          />
          {!hasMore ? <LoadMoreEnd /> : null}
        </>
      )}
    </CommunityShell>
  )
}