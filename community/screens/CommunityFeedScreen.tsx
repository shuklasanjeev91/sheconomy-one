import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'one'
import { Platform } from 'react-native'

import { LoadMoreEnd } from '~/commerce/components/LoadMoreSentinel'
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
import { interleaveFeedWithSuggestions, type FeedEntry } from '~/community/lib/interleave-feed-suggestions'
import { refreshStories } from '~/community/lib/story-refresh'
import { ScreenState, YStack, useMedia } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { APP_LAYOUT } from '~/lib/layout/constants'

const SUGGESTION_INTERVAL = 3
const FEED_LIST_BOTTOM_PAD =
  Platform.OS === 'web' ? 24 : APP_LAYOUT.mobileTabBarHeight + 64

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
  // Avoid FlashList firing onEndReached during the first layout pass.
  const endReachedReadyRef = useRef(false)
  useEffect(() => {
    endReachedReadyRef.current = false
    const timer = setTimeout(() => {
      endReachedReadyRef.current = true
    }, 700)
    return () => clearTimeout(timer)
  }, [sort, contentFilter])

  const feedEntries = useMemo((): FeedEntry[] => {
    if (isDesktop || !sections.length) {
      return items.map((post) => ({ type: 'post' as const, post }))
    }
    return interleaveFeedWithSuggestions(items, sections, SUGGESTION_INTERVAL)
  }, [isDesktop, items, sections])

  const onRefresh = useCallback(async () => {
    refresh()
    refreshSuggestions()
    refreshStories()
  }, [refresh, refreshSuggestions])

  const onPostUpdated = useCallback(
    (postId: string, patch: Parameters<typeof patchItem>[1]) => {
      patchItem(postId, patch)
    },
    [patchItem],
  )

  const renderItem = useCallback(
    ({ item }: { item: FeedEntry }) => {
      if (item.type === 'post') {
        return (
          <YStack width="100%" paddingBottom={12}>
            <FeedPostCard
              post={item.post}
              onPostDeleted={removeItem}
              onPostUpdated={onPostUpdated}
            />
          </YStack>
        )
      }
      return (
        <YStack width="100%" paddingBottom={12}>
          <CommunitySuggestionSectionCard section={item.section} limit={3} />
        </YStack>
      )
    },
    [onPostUpdated, removeItem],
  )

  const keyExtractor = useCallback((entry: FeedEntry) => {
    if (entry.type === 'post') return entry.post.id
    return `suggestion-${entry.section.kind}-${entry.slot}`
  }, [])

  const getItemType = useCallback((entry: FeedEntry) => entry.type, [])

  const listHeader = useMemo(
    () => (
      <YStack gap="$3" width="100%" paddingBottom="$2">
        <StoriesStrip />
        {isDesktop ? <FeedComposer /> : null}
        <FeedFilterChips value={contentFilter} onChange={setContentFilter} />
        <FeedSortBar value={sort} onChange={setSort} />
      </YStack>
    ),
    [contentFilter, isDesktop, sort],
  )

  const listFooter = useMemo(
    () => (
      <YStack paddingVertical="$3" width="100%">
        {isLoadingMore ? null : null}
        {!hasMore && items.length > 0 ? <LoadMoreEnd /> : null}
      </YStack>
    ),
    [hasMore, isLoadingMore, items.length],
  )

  return (
    <CommunityShell scroll={false} refreshing={isRefreshing} onRefresh={onRefresh}>
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
          <FlashList
            data={feedEntries}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemType={getItemType}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            onEndReached={() => {
              if (!endReachedReadyRef.current) return
              if (hasMore && !isLoadingMore) loadMore()
            }}
            onEndReachedThreshold={0.4}
            onRefresh={onRefresh}
            refreshing={isRefreshing}
            drawDistance={Platform.OS === 'web' ? 500 : 250}
            style={{ flex: 1, width: '100%' }}
            contentContainerStyle={{ paddingBottom: FEED_LIST_BOTTOM_PAD }}
          />
        ) : (
          listHeader
        )}
      </ScreenState>
    </CommunityShell>
  )
}
