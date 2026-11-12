import { useState, type ReactNode } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import type { Href } from 'one'

import { Spinner, Text, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { PageSection } from '~/components/layout'
import type { ListingFeedKind } from '~/lib/supabase/commerce'
import { useListingFeed } from '~/commerce/hooks/useListingFeed'
import { useSponsoredCommerce } from '~/commerce/hooks/useSponsoredCommerce'
import { listingGridColumnsForWidth } from '~/lib/layout/listing-grid-columns'

import { CommerceSection } from '~/commerce/components/CommerceSection'
import { ListingGrid } from '~/commerce/components/ListingGrid'
import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { useAppUi } from '~/lib/theme/useAppUi'

type InfiniteListingSectionProps = {
  kind: ListingFeedKind
  title: string
  subtitle?: string
  actionLabel?: string
  actionHref?: Href
  shopId?: string
  enabled?: boolean
  /** Wrap in PageSection only when content exists (avoids empty home gaps). */
  inset?: boolean
  /** Defaults on for public browse grids and off for embedded/storefront grids. */
  sponsored?: boolean
  /** When true, render the grid without the section title chrome (page header owns it). */
  hideHeader?: boolean
}

export function InfiniteListingSection({
  kind,
  title,
  subtitle,
  actionLabel,
  actionHref,
  shopId,
  enabled = true,
  inset = false,
  sponsored = !inset && !shopId,
  hideHeader = false,
}: InfiniteListingSectionProps) {
  const ui = useAppUi()
  const { listingGridColumns: fallbackColumns } = useAppLayout()
  const [measuredColumns, setMeasuredColumns] = useState<number | null>(null)
  const gridColumns = (measuredColumns ?? fallbackColumns) as 2 | 3 | 4 | 5 | 6
  const { items, isLoading, isLoadingMore, hasMore, error, loadMore } = useListingFeed({
    kind,
    shopId,
    enabled,
  })
  const sponsoredCommerce = useSponsoredCommerce({
    placement: 'commerce_browse',
    context: { keywords: [kind] },
    enabled: enabled && sponsored && !shopId,
    limit: 2,
  })

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width
    if (nextWidth <= 0) return
    const nextColumns = listingGridColumnsForWidth(nextWidth)
    setMeasuredColumns((current) => (current === nextColumns ? current : nextColumns))
  }

  function wrap(node: ReactNode) {
    return inset ? <PageSection>{node}</PageSection> : node
  }

  if (isLoading) {
    return wrap(
      <YStack width="100%" alignItems="center" paddingVertical="$4">
        <Spinner size="small" />
      </YStack>,
    )
  }

  const grid = (
    <YStack gap="$4" width="100%" onLayout={handleLayout}>
      {error ? (
        <Text color={ui.textSecondary} fontSize={14}>
          {error}
        </Text>
      ) : (
        <>
          <ListingGrid
            listings={items}
            columns={gridColumns}
            sponsoredItems={sponsoredCommerce.items}
            onSponsoredEvent={(item, event) => void sponsoredCommerce.track(item, event)}
          />
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
          />
          {!hasMore ? <LoadMoreEnd /> : null}
        </>
      )}
    </YStack>
  )

  if (error) {
    if (hideHeader) return wrap(grid)
    return wrap(
      <CommerceSection title={title} subtitle={subtitle}>
        {grid}
      </CommerceSection>,
    )
  }

  if (!items.length) return null

  if (hideHeader) return wrap(grid)

  return wrap(
    <CommerceSection
      title={title}
      subtitle={subtitle}
      actionLabel={actionLabel}
      actionHref={actionHref}
    >
      {grid}
    </CommerceSection>,
  )
}
