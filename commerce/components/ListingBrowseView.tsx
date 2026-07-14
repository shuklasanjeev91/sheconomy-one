import type { ReactNode } from 'react'

import { Spinner, Text, YStack, useMedia, Icons } from '~/components/ui'
import type { ListingSummary } from '~/lib/supabase/commerce'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CommercePageHeader } from './CommercePageHeader'
import { ListingGrid } from './ListingGrid'
import { LoadMoreEnd, LoadMoreSentinel } from './LoadMoreSentinel'

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
  emptyMessage = 'No listings found.',
  hideHeader = false,
  showQuickAdd = false,
}: ListingBrowseViewProps) {
  const ui = useAppUi()
  const media = useMedia()
  const gridColumns = media.gtLg ? 6 : media.gtMd ? 5 : media.gtSm ? 3 : 2

  return (
    <YStack gap="$4" width="100%">
      {hideHeader ? null : header ?? <CommercePageHeader title={title} subtitle={subtitle} />}

      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" />
        </YStack>
      ) : error ? (
        <Text color={ui.textSecondary} fontSize={14}>
          {error}
        </Text>
      ) : items.length === 0 ? (
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
          <ListingGrid listings={items} columns={gridColumns} showQuickAdd={showQuickAdd} />
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
          />
          {!hasMore ? <LoadMoreEnd /> : null}
        </YStack>
      )}
    </YStack>
  )
}