import type { ReactNode } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import { ScrollView, Spinner, XStack, YStack } from '~/components/ui'

type InfiniteHorizontalSectionProps = {
  children: ReactNode
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  /** Custom placeholders shown while loading the next page. */
  loadMorePlaceholder?: ReactNode
  /** Spacing between items (Tamagui space token). Defaults to `$3`. */
  gap?: `$${number}` | number
}

/** Horizontal row that loads the next page when scrolled near the end. */
export function InfiniteHorizontalSection({
  children,
  hasMore,
  isLoadingMore,
  onLoadMore,
  loadMorePlaceholder,
  gap = '$3',
}: InfiniteHorizontalSectionProps) {
  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!hasMore || isLoadingMore) return

    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
    const nearEnd = layoutMeasurement.width + contentOffset.x >= contentSize.width - 220

    if (nearEnd) onLoadMore()
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onScroll={handleScroll}
      onMomentumScrollEnd={handleScroll}
      scrollEventThrottle={100}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ flexGrow: 0, alignItems: 'flex-start' }}
    >
      <XStack gap={gap} paddingRight="$5" alignItems="flex-start">
        {children}
        {isLoadingMore
          ? (loadMorePlaceholder ?? (
              <YStack width={48} alignItems="center" justifyContent="center" height={48}>
                <Spinner size="small" />
              </YStack>
            ))
          : null}
      </XStack>
    </ScrollView>
  )
}
