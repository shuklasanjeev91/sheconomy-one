import type { ReactNode } from 'react'
import { Platform } from 'react-native'
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
} from '~/components/ui'
import { BRAND_THEME, getShadowStyle } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
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
} from '~/commerce/components/ListingFiltersPanel'
import { ListingActiveFilterChips } from '~/commerce/components/ListingActiveFilterChips'
import { ListingSortMenu } from '~/commerce/components/ListingSortMenu'
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
  /**
   * Desktop: always-visible left filter column (marketplace category PLP).
   * Defaults on when inventory-driven facets are present.
   */
  persistentSidebar?: boolean
  /** Live result count shown in the toolbar. */
  resultCount?: number | null
  children: ReactNode
}

const SIDEBAR_WIDTH = 280

/** Filters — persistent left sidebar on desktop, sticky toolbar + sheet elsewhere. */
export function ListingFiltersShell({
  filters,
  onApply,
  showTypeFilter = true,
  resultsLabel = 'Show results',
  facets,
  facetsLoading = false,
  inventoryDriven = false,
  sortInToolbar = false,
  persistentSidebar,
  resultCount,
  children,
}: ListingFiltersShellProps) {
  const ui = useAppUi()
  const { isWide } = useAppLayout()
  // Only pin a left filter column on very wide screens so the results grid
  // still has room beside app chrome / side rails.
  const useSidebar =
    persistentSidebar ?? (isWide && inventoryDriven)
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
    !useSidebar &&
    (sortInToolbar ||
      !inventoryDriven ||
      (facets != null && hasCategoryFilterOptions(facets)))
  const showToolbar = showFilterButton || showSortToolbar || resultCount != null || activeCount > 0
  const currentSort = filters.sort ?? 'relevance'
  const resolvedSortOptions =
    sortOptions.length > 0
      ? sortOptions
      : LISTING_SORT_OPTIONS.filter((option) => option.value === 'relevance' || option.value === 'newest')

  useEffect(() => {
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
  }, [filters, facets?.priceRange, setMinPrice, setMaxPrice])

  useEffect(() => {
    if (open) {
      setDraft(filters)
    }
  }, [open, filters])

  function close() {
    setOpen(false)
  }

  function commitFilters(nextDraft: ListingBrowseFilters, nextMin = minPrice, nextMax = maxPrice) {
    let next = mergeDraftPriceInputs(nextDraft, nextMin, nextMax)

    if (facets?.priceRange) {
      const atFullRange =
        next.minPrice === facets.priceRange.min && next.maxPrice === facets.priceRange.max
      if (atFullRange) {
        next = { ...next, minPrice: undefined, maxPrice: undefined }
      }
    }

    onApply(next)
  }

  function applyDraft() {
    commitFilters(draft)
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

  function applySidebarDraft() {
    commitFilters(draft)
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
        <Button tone="primary" size="$4" borderRadius={8} width="100%" onPress={applyDraft}>
          {resultsLabel}
        </Button>
      </Theme>
    </YStack>
  )

  const sidebarFooter = (
    <YStack
      gap="$2.5"
      paddingTop="$3"
      borderTopWidth={1}
      borderTopColor={ui.panelBorder}
      width="100%"
    >
      {hasActiveFilters(draft) || minPrice || maxPrice ? (
        <Button tone="ghost" size="$3" onPress={clearDraft} alignSelf="flex-start">
          Clear all
        </Button>
      ) : null}
      <Theme name={BRAND_THEME}>
        <Button tone="primary" size="$4" borderRadius={8} width="100%" onPress={applySidebarDraft}>
          {resultsLabel}
        </Button>
      </Theme>
    </YStack>
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

  const toolbar = showToolbar ? (
    <XStack
      width="100%"
      alignItems="center"
      gap="$3"
      flexWrap="wrap"
      zIndex={10}
      paddingVertical="$2"
      paddingHorizontal={useSidebar ? 0 : undefined}
      backgroundColor={ui.surfaceMuted}
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
      style={
        Platform.OS === 'web' && !useSidebar
          ? ({
              position: 'sticky',
              top: 0,
              zIndex: 20,
              backdropFilter: 'blur(12px)',
            } as const)
          : undefined
      }
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
            <Text fontSize={14} fontWeight="600" color={ui.text}>
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

      {resultCount != null ? (
        <Text fontSize={14} fontWeight="600" color={ui.textSecondary} flexShrink={0}>
          {resultCount.toLocaleString('en-IN')} {resultCount === 1 ? 'result' : 'results'}
        </Text>
      ) : null}

      <XStack flex={1} minWidth={8} />

      {activeCount > 0 && !useSidebar ? (
        <Button
          tone="ghost"
          size="$3"
          borderRadius={999}
          flexShrink={0}
          onPress={clearDraft}
          accessibilityLabel={`Clear ${activeCount} filters`}
          testID="clear-listing-filters"
        >
          Clear ({activeCount})
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
  ) : null

  const chips = (
    <ListingActiveFilterChips
      filters={filters}
      facets={facets}
      excludeSort={sortInToolbar}
      onChange={onApply}
    />
  )

  const resultsColumn = (
    <YStack flex={1} minWidth={0} width="100%" gap="$3">
      {toolbar}
      {chips}
      {children}
    </YStack>
  )

  if (useSidebar) {
    return (
      <XStack
        width="100%"
        maxWidth="100%"
        alignItems="flex-start"
        gap="$5"
        alignSelf="stretch"
      >
        <YStack
          width={SIDEBAR_WIDTH}
          flexShrink={0}
          backgroundColor={ui.surface}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          borderRadius={16}
          padding="$4"
          gap="$4"
          style={
            Platform.OS === 'web'
              ? ({
                  position: 'sticky',
                  top: 76,
                  maxHeight: 'calc(100vh - 96px)',
                  overflowY: 'auto',
                  ...getShadowStyle('sm'),
                } as const)
              : getShadowStyle('sm')
          }
        >
          <Text fontWeight="800" fontSize={18} color={ui.text} letterSpacing={-0.3}>
            Filters
          </Text>
          {filtersBody}
          {sidebarFooter}
        </YStack>
        {resultsColumn}
      </XStack>
    )
  }

  return (
    <YStack gap="$3" width="100%">
      {resultsColumn}

      <AppBottomSheet open={open} onOpenChange={setOpen} title="Filters" footer={footer}>
        {filtersBody}
      </AppBottomSheet>
    </YStack>
  )
}
