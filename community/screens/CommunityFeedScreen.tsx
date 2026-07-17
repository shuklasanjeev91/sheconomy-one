import { useMemo, useState } from 'react'

import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { CommunitySuggestionSectionCard } from '~/community/components/CommunitySuggestionSectionCard'
import { StoriesStrip } from '~/community/components/StoriesStrip'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedComposer } from '~/community/components/FeedComposer'
import { FeedFilterChips } from '~/community/components/FeedFilterChips'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { FeedSortBar, type FeedSort } from '~/community/components/FeedSortBar'
import type { FeedContentFilter } from '~/community/lib/community'
import { useCommunityFeed } from '~/community/hooks/useCommunityFeed'
import { useCommunitySuggestions } from '~/community/hooks/useCommunitySuggestions'
import { interleaveFeedWithSuggestions } from '~/community/lib/interleave-feed-suggestions'
import { refreshStories } from '~/community/lib/story-refresh'
import { ScreenState, useMedia } from '~/components/ui'
import { useRouter } from 'one'
import { communityRoutes } from '~/lib/routes'

const SUGGESTION_INTERVAL = 3

export function CommunityFeedScreen() {
  const router = useRouter()
  const [sort, setSort] = useState<FeedSort>('recent')
  const [contentFilter, setContentFilter] = useState<FeedContentFilter | null>(null)
  const media = useMedia()
  const isDesktop = media.gtLg
  const { items, isLoading, isLoadingMore, isRefreshing, hasMore, error, loadMore, refresh, removeItem, patchItem } =
    useCommunityFeed(true, sort, contentFilter ?? undefined)
  const { sections, refresh: refreshSuggestions } = useCommunitySuggestions(4)
  const showingCached = items.length > 0 && !!error

  const feedEntries = useMemo(() => {
    if (isDesktop || !sections.length) {
      return items.map((post) => ({ type: 'post' as const, post }))
    }
    return interleaveFeedWithSuggestions(items, sections, SUGGESTION_INTERVAL)
  }, [isDesktop, items, sections])

  return (
    <CommunityShell
      refreshing={isRefreshing}
      onRefresh={async () => {
        refresh()
        refreshSuggestions()
        refreshStories()
      }}
    >
      <StoriesStrip />
      {isDesktop ? <FeedComposer /> : null}
      <FeedFilterChips value={contentFilter} onChange={setContentFilter} />
      <FeedSortBar value={sort} onChange={setSort} />

      <ScreenState
        loading={isLoading && items.length === 0}
        error={error}
        empty={!isLoading && items.length === 0}
        showingCached={showingCached}
        emptyTitle="Your feed is quiet"
        emptyMessage="Be the first to share an update with your network."
        emptyActionLabel="Create post"
        onEmptyAction={() => router.push(communityRoutes.createPost as never)}
        onRetry={refresh}
      >
        {items.length > 0 ? (
          <>
            {feedEntries.map((entry) => {
              if (entry.type === 'post') {
                return (
                  <FeedPostCard
                    key={entry.post.id}
                    post={entry.post}
                    onPostDeleted={removeItem}
                    onPostUpdated={(postId, patch) => patchItem(postId, patch)}
                  />
                )
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
              rootMargin="480px"
            />
            {!hasMore ? <LoadMoreEnd /> : null}
          </>
        ) : null}
      </ScreenState>
    </CommunityShell>
  )
}