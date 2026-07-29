import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlashList } from '@shopify/flash-list'
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

import { LoadMoreEnd } from '~/commerce/components/LoadMoreSentinel'
import { CommunitySuggestionSectionCard } from '~/community/components/CommunitySuggestionSectionCard'
import { StoriesStrip } from '~/community/components/StoriesStrip'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedComposer } from '~/community/components/FeedComposer'
import { TodayCelebrationsCard } from '~/community/components/TodayCelebrationsCard'
import { FeedFilterChips } from '~/community/components/FeedFilterChips'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { FeedSortBar, type FeedSort } from '~/community/components/FeedSortBar'
import type { FeedContentFilter } from '~/community/lib/community'
import { openComposer } from '~/community/lib/composer-store'
import { useCommunityFeed } from '~/community/hooks/useCommunityFeed'
import { useCommunitySuggestions } from '~/community/hooks/useCommunitySuggestions'
import { interleaveFeedWithSuggestions, type FeedEntry } from '~/community/lib/interleave-feed-suggestions'
import { refreshStories } from '~/community/lib/story-refresh'
import { useAppBarScroll } from '~/components/navigation/AppBarScrollContext'
import { ScreenState, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { APP_LAYOUT } from '~/lib/layout/constants'

const SUGGESTION_INTERVAL = 3
const FEED_LIST_BOTTOM_PAD =
  Platform.OS === 'web' ? 24 : APP_LAYOUT.mobileTabBarHeight + 64

export function CommunityFeedScreen() {
  const [sort, setSort] = useState<FeedSort>('recent')
  const [contentFilter, setContentFilter] = useState<FeedContentFilter | null>(null)
  // Use window-width layout (not Tamagui useMedia) so phones are never treated as
  // desktop — otherwise suggestions are skipped here and the right rail is also hidden.
  const { isWide } = useAppLayout()
  const { setScrollY } = useAppBarScroll()
  const { items, isLoading, isLoadingMore, isRefreshing, hasMore, error, loadMore, refresh, removeItem, patchItem } =
    useCommunityFeed(true, sort, contentFilter ?? undefined)
  // Load suggestions immediately so FlashList can interleave them with the first paint.
  const { sections, refresh: refreshSuggestions } = useCommunitySuggestions(4, {
    deferUntilIdle: false,
  })
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

  useEffect(() => {
    return () => setScrollY(0)
  }, [setScrollY])

  // Only skip in-feed suggestions when the right sidebar actually shows them.
  const showSuggestionsInFeed = !isWide && sections.length > 0

  const feedEntries = useMemo((): FeedEntry[] => {
    if (!showSuggestionsInFeed) {
      return items.map((post) => ({ type: 'post' as const, post }))
    }
    return interleaveFeedWithSuggestions(items, sections, SUGGESTION_INTERVAL)
  }, [items, sections, showSuggestionsInFeed])

  const onRefresh = useCallback(async () => {
    refresh()
    refreshSuggestions()
    refreshStories()
  }, [refresh, refreshSuggestions])

  const onFeedScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrollY(event.nativeEvent.contentOffset.y)
    },
    [setScrollY],
  )

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

  // Keep chrome inside the list so one scroller owns the middle column
  // (stories/composer outside FlashList left FlashList with no bounded height → no scroll).
  const listHeader = useMemo(
    () => (
      <YStack gap="$3" width="100%" paddingBottom="$2">
        <StoriesStrip />
        <TodayCelebrationsCard />
        <FeedComposer />
        <FeedFilterChips value={contentFilter} onChange={setContentFilter} />
        <FeedSortBar value={sort} onChange={setSort} />
      </YStack>
    ),
    [contentFilter, sort],
  )

  const listFooter = useMemo(
    () => (
      <YStack paddingVertical="$3" width="100%">
        {!hasMore && items.length > 0 ? <LoadMoreEnd /> : null}
      </YStack>
    ),
    [hasMore, items.length],
  )

  return (
    <CommunityShell scroll={false} refreshing={isRefreshing} onRefresh={onRefresh}>
      <YStack flex={1} width="100%" minHeight={0} style={{ minHeight: 0 }}>
        <ScreenState
          loading={isLoading && items.length === 0}
          error={error}
          empty={!isLoading && items.length === 0}
          showingCached={showingCached}
          emptyTitle="Your feed is quiet"
          emptyMessage="Be the first to share an update with your network."
          emptyActionLabel="Create post"
          onEmptyAction={() => openComposer()}
          onRetry={refresh}
        >
          {items.length > 0 ? (
            <YStack flex={1} minHeight={0} width="100%" style={{ minHeight: 0 }}>
              <FlashList
                data={feedEntries}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                getItemType={getItemType}
                extraData={sections}
                ListHeaderComponent={listHeader}
                ListFooterComponent={listFooter}
                onScroll={onFeedScroll}
                scrollEventThrottle={16}
                onEndReached={() => {
                  if (!endReachedReadyRef.current) return
                  if (hasMore && !isLoadingMore) loadMore()
                }}
                onEndReachedThreshold={0.4}
                onRefresh={onRefresh}
                refreshing={isRefreshing}
                drawDistance={Platform.OS === 'web' ? 500 : 250}
                style={
                  Platform.OS === 'web'
                    ? ({ flex: 1, width: '100%', height: '100%', minHeight: 0, overflowY: 'auto' } as const)
                    : { flex: 1, width: '100%' }
                }
                contentContainerStyle={{ paddingBottom: FEED_LIST_BOTTOM_PAD }}
              />
            </YStack>
          ) : (
            listHeader
          )}
        </ScreenState>
      </YStack>
    </CommunityShell>
  )
}
