import { useRouter } from 'one'
import { useEffect, useMemo } from 'react'

import { ListingBrowseView, ListingFiltersShell } from '~/commerce/components'
import { useSearchListings } from '~/commerce/hooks/useSearchListings'
import {
  buildFilterSearchParams,
  type ListingBrowseFilters,
} from '~/commerce/lib/filters'
import {
  clearSearchHistory,
  recordSearchTerm,
  removeSearchTerm,
  useSearchHistory,
} from '~/commerce/lib/search-history'
import { FullWidthLayout, HorizontalScrollRow, PageSection } from '~/components/layout'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type SearchScreenProps = {
  query?: string
  filters?: ListingBrowseFilters
}

export function SearchScreen({ query: queryProp = '', filters: initialFilters = {} }: SearchScreenProps) {
  const router = useRouter()
  const ui = useAppUi()
  const query = queryProp
  const filters = initialFilters
  const history = useSearchHistory()
  const listingsFeed = useSearchListings({ query, filters, enabled: query.trim().length > 0 })

  const filterKey = useMemo(() => JSON.stringify(filters), [filters])

  useEffect(() => {
    if (query.trim()) recordSearchTerm(query)
  }, [query])

  function updateFilters(next: ListingBrowseFilters) {
    const params = buildFilterSearchParams(new URLSearchParams(), next)
    if (query.trim()) params.set('q', query.trim())
    const search = params.toString()
    router.replace(
      (search ? `${commerceRoutes.search()}?${search}` : commerceRoutes.search()) as never,
    )
  }

  function runHistoryTerm(term: string) {
    recordSearchTerm(term)
    router.push(commerceRoutes.search(term) as never)
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
          <YStack gap="$5" width="100%">
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

            {history.length > 0 ? (
              <YStack gap="$3" width="100%">
                <XStack alignItems="center" justifyContent="space-between" gap="$2">
                  <Text fontSize={15} fontWeight="700" color={ui.text}>
                    Recent searches
                  </Text>
                  <Text
                    fontSize={13}
                    fontWeight="600"
                    color={ui.textMuted}
                    cursor="pointer"
                    pressStyle={{ opacity: 0.8 }}
                    onPress={() => clearSearchHistory()}
                  >
                    Clear
                  </Text>
                </XStack>
                <HorizontalScrollRow gap="$2">
                  {history.map((term) => (
                    <XStack
                      key={term}
                      alignItems="center"
                      gap="$1.5"
                      paddingLeft="$3"
                      paddingRight="$2"
                      paddingVertical="$2"
                      borderRadius={999}
                      borderWidth={1}
                      borderColor={ui.borderSubtle}
                      backgroundColor={ui.surface}
                    >
                      <XStack
                        alignItems="center"
                        gap="$1.5"
                        cursor="pointer"
                        onPress={() => runHistoryTerm(term)}
                        pressStyle={{ opacity: 0.85 }}
                      >
                        <Icons.Clock size={14} color={ui.textMuted} />
                        <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={1}>
                          {term}
                        </Text>
                      </XStack>
                      <XStack
                        cursor="pointer"
                        padding={4}
                        onPress={() => removeSearchTerm(term)}
                        pressStyle={{ opacity: 0.7 }}
                        hitSlop={8}
                      >
                        <Icons.X size={12} color={ui.textMuted} />
                      </XStack>
                    </XStack>
                  ))}
                </HorizontalScrollRow>
              </YStack>
            ) : null}

            <Button
              alignSelf="flex-start"
              tone="outline"
              borderRadius={999}
              icon={<Icons.Heart size={15} />}
              onPress={() => router.push(commerceRoutes.favorites as never)}
            >
              Open wishlist
            </Button>
          </YStack>
        )}
      </PageSection>
    </FullWidthLayout>
  )
}
