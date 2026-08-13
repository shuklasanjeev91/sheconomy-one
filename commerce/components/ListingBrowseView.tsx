import type { ReactNode } from 'react'

import { Button, CardSkeleton, Spinner, Text, XStack, YStack, Icons } from '~/components/ui'
import type { ListingSummary } from '~/lib/supabase/commerce'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CommercePageHeader } from '~/commerce/components/CommercePageHeader'
import { ListingGrid } from '~/commerce/components/ListingGrid'
import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'

type ListingBrowseViewProps = {
  title: string
  subtitle?: string
  header?: ReactNode
  items: ListingSummary[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  onLoadMore: () => void
  onRetry?: () => void
  emptyMessage?: string
  hideHeader?: boolean
  showQuickAdd?: boolean
}

/** Browse page body — header, grid, infinite scroll. */
export function ListingBrowseView({
  title,
  subtitle,
  header,
  items,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onLoadMore,
  onRetry,
  emptyMessage = 'No listings found.',
  hideHeader = false,
  showQuickAdd = false,
}: ListingBrowseViewProps) {
  const ui = useAppUi()
  const { listingGridColumns: gridColumns } = useAppLayout()
  const hasItems = items.length > 0

  return (
    <YStack gap="$4" width="100%">
      {hideHeader ? null : header ?? <CommercePageHeader title={title} subtitle={subtitle} />}

      {isLoading && !hasItems ? (
        <XStack flexWrap="wrap" gap="$3" width="100%">
          {Array.from({ length: Math.min(gridColumns * 2, 8) }).map((_, index) => (
            <YStack key={index} flexBasis={`${100 / gridColumns}%`} flexGrow={1} minWidth={140} maxWidth="100%">
              <CardSkeleton />
            </YStack>
          ))}
        </XStack>
      ) : !hasItems && error ? (
        <YStack
          alignItems="center"
          justifyContent="center"
          paddingVertical="$10"
          paddingHorizontal="$5"
          gap="$3"
        >
          <Text fontWeight="700" fontSize={16} color={ui.text} textAlign="center">
            Couldn’t load listings
          </Text>
          <Text color={ui.textSecondary} fontSize={14} textAlign="center">
            {error}
          </Text>
          {onRetry ? (
            <Button
              size="$3"
              theme="active"
              borderRadius={999}
              minHeight={44}
              onPress={onRetry}
              accessibilityLabel="Retry loading listings"
            >
              Try again
            </Button>
          ) : null}
        </YStack>
      ) : !hasItems ? (
        <YStack
          alignItems="center"
          justifyContent="center"
          paddingVertical="$10"
          paddingHorizontal="$5"
          gap="$3"
          borderRadius={radius.card}
          backgroundColor={ui.surfaceMuted}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          style={getShadowStyle('sm')}
        >
          <Icons.Search size={36} color={ui.brand} opacity={0.7} />
          <Text fontWeight="800" fontSize={17} color={ui.text} letterSpacing={-0.25} textAlign="center">
            {emptyMessage}
          </Text>
          <Text color={ui.textMuted} fontSize={14} textAlign="center" maxWidth={360} lineHeight={21}>
            Try adjusting your search or browse other categories.
          </Text>
        </YStack>
      ) : (
        <YStack gap="$4" width="100%">
          {error ? (
            <XStack
              alignItems="center"
              justifyContent="space-between"
              gap="$3"
              padding="$3"
              borderRadius="$4"
              borderWidth={1}
              borderColor={ui.border}
              backgroundColor={ui.surface}
              flexWrap="wrap"
            >
              <Text flex={1} minWidth={180} color={ui.textMuted} fontSize={13}>
                {error} — showing loaded results.
              </Text>
              {onRetry ? (
                <Button size="$2" tone="ghost" onPress={onRetry} accessibilityLabel="Retry">
                  Retry
                </Button>
              ) : null}
            </XStack>
          ) : null}
          <ListingGrid listings={items} columns={gridColumns} showQuickAdd={showQuickAdd} />
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
          />
          {!hasMore && !error ? <LoadMoreEnd /> : null}
          {isLoadingMore ? (
            <YStack alignItems="center" paddingVertical="$3">
              <Spinner size="small" />
            </YStack>
          ) : null}
        </YStack>
      )}
    </YStack>
  )
}
