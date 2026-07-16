import type { ReactNode } from 'react'

import { Button, Spinner, Text, YStack } from '~/components/ui'
import { useInfiniteScroll } from '~/hooks/useInfiniteScroll'
import { useAppUi } from '~/lib/theme/useAppUi'

type LoadMoreSentinelProps = {
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  label?: string
  /** Distance before the sentinel enters view that triggers load (px). */
  rootMargin?: string | number
}

export function LoadMoreSentinel({
  hasMore,
  isLoadingMore,
  onLoadMore,
  label = 'Load more',
  rootMargin = '240px',
}: LoadMoreSentinelProps) {
  const ui = useAppUi()
  const { sentinelRef, supportsAutoLoad } = useInfiniteScroll(onLoadMore, {
    enabled: hasMore && !isLoadingMore,
    rootMargin,
  })

  if (!hasMore && !isLoadingMore) return null

  return (
    <YStack
      ref={sentinelRef as never}
      width="100%"
      alignItems="center"
      justifyContent="center"
      paddingVertical="$4"
      gap="$2"
      minHeight={1}
      onLayout={() => {
        // Native: re-measure after layout so scrollY checks see the sentinel.
      }}
    >
      {isLoadingMore ? (
        <Spinner size="small" />
      ) : hasMore && !supportsAutoLoad ? (
        <Button tone="outline" size="$3" borderRadius={999} onPress={onLoadMore}>
          {label}
        </Button>
      ) : hasMore ? (
        <Text fontSize={12} color={ui.textMuted}>
          Scroll for more
        </Text>
      ) : null}
    </YStack>
  )
}

type LoadMoreEndProps = {
  children?: ReactNode
}

export function LoadMoreEnd({ children }: LoadMoreEndProps) {
  const ui = useAppUi()

  return (
    <YStack width="100%" alignItems="center" paddingVertical="$3">
      {children ?? (
        <Text fontSize={12} color={ui.textMuted}>
          You&apos;ve reached the end
        </Text>
      )}
    </YStack>
  )
}