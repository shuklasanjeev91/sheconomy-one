import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlashList } from '@shopify/flash-list'
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { CommunitySuggestionSectionCard } from '~/community/components/CommunitySuggestionSectionCard'
import { StoriesStrip } from '~/community/components/StoriesStrip'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedComposer } from '~/community/components/FeedComposer'
import { EventRevisitStrip } from '~/community/components/EventRevisitStrip'
import { FollowedShopActivityStrip } from '~/community/components/FollowedShopActivityStrip'
import { PickUpAgainStrip } from '~/community/components/PickUpAgainStrip'
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
import { isWebRuntime } from '~/lib/platform/capabilities'

const SUGGESTION_INTERVAL = 3
const FEED_LIST_BOTTOM_PAD =
  Platform.OS === 'web' ? 24 : APP_LAYOUT.mobileTabBarHeight + 64

/**
 * FlashList v2 is New-Architecture oriented and has been blanking /community
 * on web reload. Web uses shell ScrollView + mapped rows; native keeps FlashList.
 */
const USE_FLASH_LIST = !isWebRuntime()

export function CommunityFeedScreen() {
  const [sort, setSort] = useState<FeedSort>('recent')
  const [contentFilter, setContentFilter] = useState<FeedContentFilter | null>(null)
  // Use window-width layout (not Tamagui useMedia) so phones are never treated as
  // desktop — otherwise suggestions are skipped here and the right rail is also hidden.
  const { hasDualSideRails } = useAppLayout()
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
  const showSuggestionsInFeed = !hasDualSideRails && sections.length > 0

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

  const renderEntry = useCallback(
    (entry: FeedEntry) => {
      if (entry.type === 'post') {
        return (
          <YStack key={entry.post.id} width="100%" paddingBottom={12}>
            <FeedPostCard
              post={entry.post}
              onPostDeleted={removeItem}
              onPostUpdated={onPostUpdated}
            />
          </YStack>
        )
      }
      return (
        <YStack
          key={`suggestion-${entry.section.kind}-${entry.slot}`}
          width="100%"
          paddingBottom={12}
        >
          <CommunitySuggestionSectionCard section={entry.section} limit={3} />
        </YStack>
      )
    },
    [onPostUpdated, removeItem],
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
        <TodayCelebrationsCard />
        <PickUpAgainStrip />
        <EventRevisitStrip />
        <FollowedShopActivityStrip />
        <FeedComposer />
        <FeedFilterChips value={contentFilter} onChange={setContentFilter} />
        <FeedSortBar value={sort} onChange={setSort} />
      </YStack>
    ),
    [contentFilter, sort],
  )

  const listFooter = useMemo(
    () => (
      <YStack paddingVertical="$3" width="100%" paddingBottom={FEED_LIST_BOTTOM_PAD}>
        {!hasMore && items.length > 0 ? <LoadMoreEnd /> : null}
      </YStack>
    ),
    [hasMore, items.length],
  )

  const onEndReached = useCallback(() => {
    if (!endReachedReadyRef.current) return
    if (hasMore && !isLoadingMore) loadMore()
  }, [hasMore, isLoadingMore, loadMore])

  return (
    <CommunityShell
      // Web: shell ScrollView owns the middle column (avoids FlashList blank reload).
      // Native: FlashList owns scrolling inside a locked shell.
      scroll={!USE_FLASH_LIST}
      refreshing={isRefreshing}
      onRefresh={onRefresh}
    >
      <YStack
        flex={USE_FLASH_LIST ? 1 : undefined}
        width="100%"
        minHeight={USE_FLASH_LIST ? 0 : undefined}
        style={USE_FLASH_LIST ? { minHeight: 0 } : undefined}
      >
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
          fill={USE_FLASH_LIST}
        >
          {items.length > 0 ? (
            USE_FLASH_LIST ? (
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
                  onEndReached={onEndReached}
                  onEndReachedThreshold={0.4}
                  onRefresh={onRefresh}
                  refreshing={isRefreshing}
                  drawDistance={250}
                  style={{ flex: 1, width: '100%' }}
                  contentContainerStyle={{ paddingBottom: FEED_LIST_BOTTOM_PAD }}
                />
              </YStack>
            ) : (
              <YStack width="100%" gap="$3">
                {listHeader}
                {feedEntries.map(renderEntry)}
                <LoadMoreSentinel
                  hasMore={hasMore}
                  isLoadingMore={isLoadingMore}
                  onLoadMore={onEndReached}
                />
                {!hasMore ? listFooter : null}
              </YStack>
            )
          ) : (
            listHeader
          )}
        </ScreenState>
      </YStack>
    </CommunityShell>
  )
}
