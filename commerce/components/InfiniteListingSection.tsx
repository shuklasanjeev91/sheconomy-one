import type { Href } from 'one'

import { Spinner, Text, YStack, useMedia } from '~/components/ui'
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
}

export function InfiniteListingSection({
  kind,
  title,
  subtitle,
  actionLabel,
  actionHref,
  shopId,
  enabled = true,
}: InfiniteListingSectionProps) {
  const ui = useAppUi()
  const media = useMedia()
  const gridColumns = media.gtLg ? 6 : media.gtMd ? 5 : media.gtSm ? 3 : 2
  const { items, isLoading, isLoadingMore, hasMore, error, loadMore } = useListingFeed({
    kind,
    shopId,
    enabled,
  })

  if (isLoading) {
    return (
      <YStack width="100%" alignItems="center" paddingVertical="$6">
        <Spinner size="small" />
      </YStack>
    )
  }

  if (error) {
    return (
      <CommerceSection title={title} subtitle={subtitle}>
        <Text color={ui.textSecondary} fontSize={14}>
          {error}
        </Text>
      </CommerceSection>
    )
  }

  if (!items.length) return null

  return (
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
    </CommerceSection>
  )
}