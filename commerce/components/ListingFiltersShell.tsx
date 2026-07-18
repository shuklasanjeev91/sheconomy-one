import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import {
  AppBottomSheet,
  Button,
  Icons,
  ScrollView,
  Text,
  Theme,
  XStack,
  YStack,
  useMedia,
} from '~/components/ui'
import { BRAND_THEME } from '~/config/tokens'
import {
  countActiveFilters,
  hasActiveFilters,
  LISTING_SORT_OPTIONS,
  type ListingBrowseFilters,
  type ListingSort,
} from '~/commerce/lib/filters'
import {
  getAvailableSortOptions,
  hasCategoryFilterOptions,
  type CategoryFilterFacets,
} from '~/commerce/lib/category-facets'

import {
  ListingFiltersPanel,
  mergeDraftPriceInputs,
  useFilterDraftPriceState,
} from './ListingFiltersPanel'
import { ListingSortMenu } from './ListingSortMenu'
import { overlayBackdropStyle, edgePanelPositionStyle } from '~/lib/layout/styles'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingFiltersShellProps = {
  filters: ListingBrowseFilters
  onApply: (filters: ListingBrowseFilters) => void
  showTypeFilter?: boolean
  resultsLabel?: string
  facets?: CategoryFilterFacets | null
  facetsLoading?: boolean
  inventoryDriven?: boolean
  /** Sort dropdown in the toolbar instead of inside the filter panel. */
  sortInToolbar?: boolean
  children: ReactNode
}

const SIDEBAR_WIDTH = 400

/** Filters — left sidebar on desktop, bottom sheet elsewhere. */
export function ListingFiltersShell({
  filters,
  onApply,
  showTypeFilter = true,
  resultsLabel = 'Show results',
  facets,
  facetsLoading = false,
  inventoryDriven = false,
  sortInToolbar = false,
  children,
}: ListingFiltersShellProps) {
  const ui = useAppUi()
  const media = useMedia()
  const isDesktop = media.gtMd
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ListingBrowseFilters>(filters)
  const { minPrice, maxPrice, setMinPrice, setMaxPrice } = useFilterDraftPriceState(
    draft,
    facets?.priceRange,
  )
  const activeCount = countActiveFilters(filters, { excludeSort: sortInToolbar })
  const sortOptions =
    inventoryDriven && facets ? getAvailableSortOptions(facets) : LISTING_SORT_OPTIONS
  const showSortToolbar =
    sortInToolbar && (sortOptions.length > 0 || facetsLoading || !inventoryDriven)
  const showFilterButton =
    sortInToolbar ||
    !inventoryDriven ||
    (facets != null && hasCategoryFilterOptions(facets))
  const showToolbar = showFilterButton || showSortToolbar
  const currentSort = filters.sort ?? 'relevance'
  const resolvedSortOptions =
    sortOptions.length > 0
      ? sortOptions
      : LISTING_SORT_OPTIONS.filter((option) => option.value === 'relevance' || option.value === 'newest')

  useEffect(() => {
    if (open) {
      setDraft(filters)
      setMinPrice(
        filters.minPrice != null
          ? String(filters.minPrice)
          : facets?.priceRange
            ? String(facets.priceRange.min)
            : '',
      )
      setMaxPrice(
        filters.maxPrice != null
          ? String(filters.maxPrice)
          : facets?.priceRange
            ? String(facets.priceRange.max)
            : '',
      )
    }
  }, [open, filters, facets?.priceRange, setMinPrice, setMaxPrice])

  function close() {
    setOpen(false)
  }

  function applyDraft() {
    let next = mergeDraftPriceInputs(draft, minPrice, maxPrice)

    if (facets?.priceRange) {
      const atFullRange =
        next.minPrice === facets.priceRange.min && next.maxPrice === facets.priceRange.max
      if (atFullRange) {
        next = { ...next, minPrice: undefined, maxPrice: undefined }
      }
    }

    onApply(next)
    close()
  }

  function clearDraft() {
    const next = sortInToolbar && filters.sort ? { sort: filters.sort } : {}
    setDraft(next)
    setMinPrice('')
    setMaxPrice('')
    onApply(next)
    close()
  }

  function applySort(sort: ListingSort) {
    onApply({ ...filters, sort })
  }

  const footer = (
    <YStack
      gap="$3"
      paddingTop="$3"
      borderTopWidth={1}
      borderTopColor={ui.panelBorder}
      width="100%"
    >
      {hasActiveFilters(draft) || minPrice || maxPrice ? (
        <Button tone="ghost" size="$3" onPress={clearDraft} alignSelf="flex-start">
          Clear all filters
        </Button>
      ) : null}
      <Theme name={BRAND_THEME}>
        <Button tone="primary" size="$4" borderRadius={999} width="100%" onPress={applyDraft}>
          {resultsLabel}
        </Button>
      </Theme>
    </YStack>
  )

  const panelHeader = (
    <Text fontWeight="700" fontSize={18} color={ui.text} letterSpacing={-0.2}>
      Filters
    </Text>
  )

  const filtersBody = (
    <ListingFiltersPanel
      draft={draft}
      onChange={setDraft}
      inventoryDriven={inventoryDriven}
      facets={facets}
      facetsLoading={facetsLoading}
      showTypeFilter={showTypeFilter}
      showSort={!sortInToolbar}
      minPrice={minPrice}
      maxPrice={maxPrice}
      onMinPriceChange={setMinPrice}
      onMaxPriceChange={setMaxPrice}
    />
  )

  return (
    <YStack gap="$3" width="100%">
      {showToolbar ? (
        <XStack
          width="100%"
          alignItems="center"
          gap="$3"
          flexWrap="nowrap"
          zIndex={10}
          paddingBottom="$1"
        >
          {showFilterButton ? (
            <Button
              tone="outline"
              size="$3"
              borderRadius={999}
              backgroundColor={ui.surface}
              borderColor={ui.text}
              flexShrink={0}
              icon={<Icons.SlidersHorizontal size={16} color={ui.text} />}
              onPress={() => setOpen(true)}
            >
              <XStack gap="$2" alignItems="center">
                <Text fontSize={14} fontWeight="500" color={ui.text}>
                  All filters
                </Text>
                {activeCount > 0 ? (
                  <XStack
                    minWidth={20}
                    height={20}
                    borderRadius={999}
                    backgroundColor={ui.text}
                    alignItems="center"
                    justifyContent="center"
                    paddingHorizontal={6}
                  >
                    <Text fontSize={11} fontWeight="700" color={ui.onBrand}>
                      {activeCount}
                    </Text>
                  </XStack>
                ) : null}
              </XStack>
            </Button>
          ) : null}

          <XStack flex={1} minWidth={8} />

          {activeCount > 0 ? (
            <Button
              tone="ghost"
              size="$3"
              borderRadius={999}
              flexShrink={0}
              minHeight={44}
              onPress={clearDraft}
              accessibilityLabel={`Clear ${activeCount} filters`}
              testID="clear-listing-filters"
            >
              Clear filters ({activeCount})
            </Button>
          ) : null}

          {showSortToolbar ? (
            <ListingSortMenu
              value={currentSort}
              options={resolvedSortOptions}
              onChange={applySort}
            />
          ) : null}
        </XStack>
      ) : null}

      {children}

      {isDesktop ? (
        open ? (
          <>
            <YStack
              backgroundColor="rgba(0,0,0,0.35)"
              zIndex={400}
              onPress={close}
              cursor="pointer"
              style={overlayBackdropStyle()}
            />
            <YStack
              width={SIDEBAR_WIDTH}
              maxWidth="90vw"
              backgroundColor={ui.surface}
              zIndex={401}
              borderRightWidth={1}
              borderRightColor={ui.panelBorder}
              style={{ ...edgePanelPositionStyle(), boxShadow: '4px 0 24px rgba(0,0,0,0.12)' }}
            >
              <YStack flex={1} padding="$4" gap="$4" height="100%">
                <XStack alignItems="center" justifyContent="space-between" width="100%">
                  {panelHeader}
                  <XStack
                    width={40}
                    height={40}
                    alignItems="center"
                    justifyContent="center"
                    borderRadius={999}
                    cursor="pointer"
                    hoverStyle={{ backgroundColor: ui.navHover }}
                    onPress={close}
                    accessibilityRole="button"
                    accessibilityLabel="Close filters"
                  >
                    <Icons.X size={22} color={ui.text} />
                  </XStack>
                </XStack>
                <ScrollView flex={1} showsVerticalScrollIndicator>
                  {filtersBody}
                </ScrollView>
                {footer}
              </YStack>
            </YStack>
          </>
        ) : null
      ) : (
        <AppBottomSheet open={open} onOpenChange={setOpen} title="Filters" footer={footer}>
          {filtersBody}
        </AppBottomSheet>
      )}
    </YStack>
  )
}