import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlashList } from '@shopify/flash-list'
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { CommunitySuggestionSectionCard } from '~/community/components/CommunitySuggestionSectionCard'
import { CommunityFeedHeader } from '~/community/components/CommunityFeedHeader'
import { MutedWordsBar } from '~/community/components/MutedWordsBar'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { SponsoredPostImpressionBoundary } from '~/community/components/SponsoredPostImpressionBoundary'
import type { FeedSort } from '~/community/components/FeedSortBar'
import type { FeedContentFilter } from '~/community/lib/community'
import { trackCommunityFeedShoppableFilter } from '~/community/lib/community-commerce-analytics'
import { openComposer } from '~/community/lib/composer-store'
import { useCommunityFeed } from '~/community/hooks/useCommunityFeed'
import { useCommunitySuggestions } from '~/community/hooks/useCommunitySuggestions'
import { useSponsoredFeed } from '~/community/hooks/useSponsoredFeed'
import { interleaveCommunityFeed, type FeedEntry } from '~/community/lib/interleave-feed-suggestions'
import { filterPostsByMutedWords, useMutedWords } from '~/community/lib/muted-words'
import { recordSponsoredImpressionOnce } from '~/community/lib/sponsored-ads'
import { refreshStories } from '~/community/lib/story-refresh'
import { useAppBarScroll } from '~/components/navigation/AppBarScrollContext'
import { ScreenState, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useQueryParam } from '~/hooks/useQueryParams'
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
  const shoppableParam = useQueryParam('shoppable')
  const [contentFilter, setContentFilter] = useState<FeedContentFilter | null>(null)

  useEffect(() => {
    if (shoppableParam === '1') {
      setContentFilter('shoppable')
    }
  }, [shoppableParam])

  const handleContentFilterChange = useCallback((value: FeedContentFilter | null) => {
    setContentFilter(value)
    if (value === 'shoppable') {
      trackCommunityFeedShoppableFilter({ enabled: true })
    }
  }, [])
  // Use window-width layout (not Tamagui useMedia) so phones are never treated as
  // desktop — otherwise suggestions are skipped here and the right rail is also hidden.
  const { hasDualSideRails } = useAppLayout()
  const { setScrollY } = useAppBarScroll()
  const { items, isLoading, isLoadingMore, isRefreshing, hasMore, error, loadMore, refresh, removeItem, patchItem } =
    useCommunityFeed(true, sort, contentFilter ?? undefined)
  const { sections, refresh: refreshSuggestions } = useCommunitySuggestions(4)
  const { items: sponsoredItems, refresh: refreshSponsored } = useSponsoredFeed(!contentFilter)
  const showingCached = items.length > 0 && !!error
  // Avoid FlashList firing onEndReached during the first layout pass.
  const endReachedReadyRef = useRef(false)
  useEffect(() => {
    endReachedReadyRef.current = false
    const timer = setTimeout(() => {
      endReachedReadyRef.current = true
    }, 150)
    return () => clearTimeout(timer)
  }, [sort, contentFilter])

  useEffect(() => {
    return () => setScrollY(0)
  }, [setScrollY])

  // Only skip in-feed suggestions when the right sidebar actually shows them.
  const showSuggestionsInFeed = !hasDualSideRails && sections.length > 0
  const mutedWords = useMutedWords()
  const visibleItems = useMemo(
    () => filterPostsByMutedWords(items, mutedWords),
    [items, mutedWords],
  )
  const hiddenByMute = items.length - visibleItems.length

  const feedEntries = useMemo((): FeedEntry[] => {
    return interleaveCommunityFeed(
      visibleItems,
      showSuggestionsInFeed ? sections : [],
      contentFilter ? [] : sponsoredItems,
      { suggestionInterval: SUGGESTION_INTERVAL, sponsoredInterval: 6 },
    )
  }, [contentFilter, visibleItems, sections, showSuggestionsInFeed, sponsoredItems])

  const onRefresh = useCallback(async () => {
    refresh()
    refreshSuggestions()
    refreshSponsored()
    refreshStories()
  }, [refresh, refreshSponsored, refreshSuggestions])

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
      if (entry.type === 'sponsored') {
        return (
          <SponsoredPostImpressionBoundary
            key={`sponsored-${entry.item.campaignId}-${entry.slot}`}
            item={entry.item}
          >
            <YStack width="100%" paddingBottom={12}>
              <FeedPostCard
                post={entry.item.post}
                sponsoredCampaignId={entry.item.campaignId}
                sponsoredDestinationUrl={entry.item.destinationUrl}
                sponsoredCallToAction={entry.item.callToAction}
                sponsoredMatchReason={entry.item.matchReason}
              />
            </YStack>
          </SponsoredPostImpressionBoundary>
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
      if (item.type === 'sponsored') {
        return (
          <YStack width="100%" paddingBottom={12}>
            <FeedPostCard
              post={item.item.post}
              sponsoredCampaignId={item.item.campaignId}
              sponsoredDestinationUrl={item.item.destinationUrl}
              sponsoredCallToAction={item.item.callToAction}
              sponsoredMatchReason={item.item.matchReason}
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
    if (entry.type === 'sponsored') return `sponsored-${entry.item.campaignId}-${entry.slot}`
    return `suggestion-${entry.section.kind}-${entry.slot}`
  }, [])

  const getItemType = useCallback((entry: FeedEntry) => entry.type, [])
  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{ item: FeedEntry; isViewable?: boolean | null }>
    }) => {
      viewableItems.forEach(({ item, isViewable }) => {
        if (isViewable && item.type === 'sponsored') recordSponsoredImpressionOnce(item.item)
      })
    },
  ).current
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 1000,
  }).current

  const listHeader = useMemo(
    () => (
      <>
        <CommunityFeedHeader
          contentFilter={contentFilter}
          sort={sort}
          onContentFilterChange={handleContentFilterChange}
          onSortChange={setSort}
        />
        <MutedWordsBar hiddenCount={hiddenByMute} />
      </>
    ),
    [contentFilter, hiddenByMute, sort],
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
                  onEndReachedThreshold={0.7}
                  onViewableItemsChanged={onViewableItemsChanged}
                  viewabilityConfig={viewabilityConfig}
                  onRefresh={onRefresh}
                  refreshing={isRefreshing}
                  drawDistance={500}
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
