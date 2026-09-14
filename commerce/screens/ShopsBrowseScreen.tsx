import { CommercePageHeader } from '~/commerce/components'
import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { AppLink } from '~/components/navigation/AppLink'
import { ShopFiltersBar } from '~/commerce/components/ShopFiltersBar'
import { ShopGrid } from '~/commerce/components/ShopGrid'
import { useShopsBrowse } from '~/commerce/hooks/useShopsBrowse'
import { Spinner, Text, Theme, YStack, useMedia } from '~/components/ui'
import { BRAND_THEME, getShadowStyle, radius } from '~/config/tokens'
import { commerceRoutes } from '~/lib/routes'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { NearbyShopsSection, NearYouLocationChip } from '~/components/location'
import { SponsoredListingsRail } from '~/commerce/components/SponsoredListingsRail'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

export function ShopsBrowseScreen() {
  const ui = useAppUi()
  const media = useMedia()
  const {
    items,
    totalCount,
    countries,
    filters,
    setFilters,
    isLoading,
    isLoadingMore,
    isRefreshing,
    hasMore,
    error,
    loadMore,
    refresh,
  } = useShopsBrowse()
  const gridColumns = media.gtLg ? 5 : media.gtMd ? 4 : media.gtSm ? 3 : 2

  return (
    <FullWidthLayout scroll onRefresh={() => refresh()} refreshing={isRefreshing}>
      <PageSection paddingVertical="$6" gap="$5" width="100%">
        <CommercePageHeader
          title="All shops"
          subtitle={`Discover women-led storefronts across ${BRAND_NAME}`}
        />

        <NearYouLocationChip />
        <NearbyShopsSection />
        <SponsoredListingsRail
          placement="shop_discovery"
          title="Sponsored shops"
          shopOnly
          limit={2}
        />

        {!isLoading && !error && (totalCount > 0 || countries.length > 0) ? (
          <ShopFiltersBar
            filters={filters}
            countries={countries}
            resultCount={items.length}
            onChange={setFilters}
          />
        ) : null}

        {isLoading && items.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$8">
            <Spinner size="large" />
          </YStack>
        ) : error ? (
          <Text color={ui.textSecondary}>{error}</Text>
        ) : items.length === 0 ? (
          <YStack
            alignItems="center"
            paddingVertical="$10"
            gap="$3"
            borderRadius={radius.card}
            backgroundColor={ui.surfaceMuted}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            style={getShadowStyle('sm')}
          >
            <Text fontWeight="700" fontSize={16} color={ui.text} letterSpacing={-0.2}>
              {filters.country !== 'all' ? 'No shops match these filters' : 'No shops yet'}
            </Text>
            <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={360}>
              {filters.country !== 'all'
                ? 'Try another country or sort option.'
                : 'Check back soon as new sellers join the marketplace.'}
            </Text>
            <AppLink href={commerceRoutes.home}>
              <Theme name={BRAND_THEME}>
                <Text color="$color9" fontWeight="500" textDecorationLine="underline">
                  Browse marketplace
                </Text>
              </Theme>
            </AppLink>
          </YStack>
        ) : (
          <>
            <ShopGrid shops={items} columns={gridColumns as 1 | 2 | 3 | 4 | 5 | 6} />
            <LoadMoreSentinel
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMore}
            />
            {!hasMore ? <LoadMoreEnd /> : null}
          </>
        )}
      </PageSection>
    </FullWidthLayout>
  )
}
