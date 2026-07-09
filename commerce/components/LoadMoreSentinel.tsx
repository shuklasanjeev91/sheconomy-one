import type { ReactNode } from 'react'

import { Button, Spinner, Text, YStack } from '~/components/ui'
import { useInfiniteScroll } from '~/hooks/useInfiniteScroll'
import { useAppUi } from '~/lib/theme/useAppUi'

type LoadMoreSentinelProps = {
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  label?: string
}

export function LoadMoreSentinel({
  hasMore,
  isLoadingMore,
  onLoadMore,
  label = 'Load more',
}: LoadMoreSentinelProps) {
  const ui = useAppUi()
  const { sentinelRef, supportsAutoLoad } = useInfiniteScroll(onLoadMore, {
    enabled: hasMore && !isLoadingMore,
  })

  if (!hasMore && !isLoadingMore) return null

  return (
    <YStack
      ref={sentinelRef as (node: unknown) => void}
      width="100%"
      alignItems="center"
      justifyContent="center"
      paddingVertical="$4"
      gap="$2"
      minHeight={supportsAutoLoad ? 1 : undefined}
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