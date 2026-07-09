import { useRouter } from 'one'
import { useMemo, useState } from 'react'

import { YStack } from '~/components/ui'
import { ListingBrowseView, ListingFiltersShell } from '~/commerce/components'
import { useSearchListings } from '~/commerce/hooks/useSearchListings'
import {
  buildFilterSearchParams,
  type ListingBrowseFilters,
} from '~/commerce/lib/filters'
import { commerceRoutes } from '~/lib/routes'
import { FullWidthLayout, PageSection } from '~/components/layout'

import { BRAND_NAME } from '~/config/brand'

type SearchScreenProps = {
  query?: string
  filters?: ListingBrowseFilters
}

export function SearchScreen({ query: queryProp = '', filters: initialFilters = {} }: SearchScreenProps) {
  const router = useRouter()
  const query = queryProp
  const filters = initialFilters
  const listingsFeed = useSearchListings({ query, filters, enabled: query.trim().length > 0 })

  const filterKey = useMemo(() => JSON.stringify(filters), [filters])

  function updateFilters(next: ListingBrowseFilters) {
    const params = buildFilterSearchParams(new URLSearchParams(), next)
    if (query.trim()) params.set('q', query.trim())
    const search = params.toString()
    router.replace(
      (search ? `${commerceRoutes.search()}?${search}` : commerceRoutes.search()) as never,
    )
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6">
        {query.trim() ? (
          <YStack gap="$5" width="100%">
          <ListingFiltersShell filters={filters} onApply={updateFilters}>
            <ListingBrowseView
              key={filterKey}
              title={`Results for "${query.trim()}"`}
              subtitle={
                !listingsFeed.isLoading && listingsFeed.items.length > 0
                  ? `${listingsFeed.items.length}${listingsFeed.hasMore ? '+' : ''} listings`
                  : undefined
              }
              items={listingsFeed.items}
              isLoading={listingsFeed.isLoading}
              isLoadingMore={listingsFeed.isLoadingMore}
              hasMore={listingsFeed.hasMore}
              error={listingsFeed.error}
              onLoadMore={listingsFeed.loadMore}
              emptyMessage={`No results for "${query.trim()}".`}
            />
          </ListingFiltersShell>
          </YStack>
        ) : (
          <ListingBrowseView
            title={`Search ${BRAND_NAME}`}
            subtitle="Find handmade, vintage, and unique items from women-led shops."
            items={[]}
            isLoading={false}
            isLoadingMore={false}
            hasMore={false}
            error={null}
            onLoadMore={() => {}}
            emptyMessage="Enter a search term above to find listings."
          />
        )}
      </PageSection>
    </FullWidthLayout>
  )
}