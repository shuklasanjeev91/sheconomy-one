import type { ReactNode } from 'react'
import type { Href } from 'one'

import { Spinner, Text, YStack, useMedia } from '~/components/ui'
import { PageSection } from '~/components/layout'
import type { ListingFeedKind } from '~/lib/supabase/commerce'
import { useListingFeed } from '~/commerce/hooks/useListingFeed'

import { CommerceSection } from './CommerceSection'
import { ListingGrid } from './ListingGrid'
import { LoadMoreEnd, LoadMoreSentinel } from './LoadMoreSentinel'
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
}: InfiniteListingSectionProps) {
  const ui = useAppUi()
  const media = useMedia()
  const gridColumns = media.gtLg ? 6 : media.gtMd ? 5 : media.gtSm ? 3 : 2
  const { items, isLoading, isLoadingMore, hasMore, error, loadMore } = useListingFeed({
    kind,
    shopId,
    enabled,
  })

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

  if (error) {
    return wrap(
      <CommerceSection title={title} subtitle={subtitle}>
        <Text color={ui.textSecondary} fontSize={14}>
          {error}
        </Text>
      </CommerceSection>,
    )
  }

  if (!items.length) return null

  return wrap(
    <CommerceSection
      title={title}
      subtitle={subtitle}
      actionLabel={actionLabel}
      actionHref={actionHref}
    >
      <YStack gap="$4" width="100%">
        <ListingGrid listings={items} columns={gridColumns} />
        <LoadMoreSentinel
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
        />
        {!hasMore ? <LoadMoreEnd /> : null}
      </YStack>
    </CommerceSection>,
  )
}
