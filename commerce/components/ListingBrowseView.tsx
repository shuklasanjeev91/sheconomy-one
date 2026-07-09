import type { ReactNode } from 'react'

import { Spinner, Text, YStack, useMedia } from '~/components/ui'
import type { ListingSummary } from '~/lib/supabase/commerce'
import { useAppUi } from '~/lib/theme/useAppUi'

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
}

/** Etsy-style browse page body — header, grid, infinite scroll. */
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
}: ListingBrowseViewProps) {
  const ui = useAppUi()
  const media = useMedia()
  const gridColumns = media.gtLg ? 6 : media.gtMd ? 5 : media.gtSm ? 3 : 2

  return (
    <YStack gap="$5" width="100%">
      {header ?? (
        <YStack gap="$1">
          <Text fontWeight="500" fontSize={28} color={ui.text} letterSpacing={-0.4} lineHeight={34}>
            {title}
          </Text>
          {subtitle ? (
            <Text color={ui.textMuted} fontSize={14} lineHeight={20}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      )}

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
          gap="$2"
          borderRadius={8}
          backgroundColor={ui.surfaceMuted}
          borderWidth={1}
          borderColor={ui.panelBorder}
        >
          <Text fontWeight="500" fontSize={16} color={ui.text}>
            {emptyMessage}
          </Text>
          <Text color={ui.textMuted} fontSize={14} textAlign="center" maxWidth={360}>
            Try adjusting your search or browse other categories.
          </Text>
        </YStack>
      ) : (
        <YStack gap="$4" width="100%">
          <ListingGrid listings={items} columns={gridColumns} />
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