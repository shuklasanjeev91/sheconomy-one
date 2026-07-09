import type { ReactNode } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import { ScrollView, Spinner, XStack, YStack } from '~/components/ui'

type InfiniteHorizontalSectionProps = {
  children: ReactNode
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}

/** Horizontal row that loads the next page when scrolled near the end. */
export function InfiniteHorizontalSection({
  children,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: InfiniteHorizontalSectionProps) {
  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!hasMore || isLoadingMore) return

    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
    const nearEnd = layoutMeasurement.width + contentOffset.x >= contentSize.width - 120

    if (nearEnd) onLoadMore()
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={200}
    >
      <XStack gap="$3" paddingRight="$5" alignItems="center">
        {children}
        {isLoadingMore ? (
          <YStack width={48} alignItems="center" justifyContent="center">
            <Spinner size="small" />
          </YStack>
        ) : null}
      </XStack>
    </ScrollView>
  )
}