import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import {
  Button,
  Icons,
  ScrollView,
  Sheet,
  SheetFrame,
  SheetHandle,
  SheetOverlay,
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
  type ListingBrowseFilters,
} from '~/commerce/lib/filters'
import {
  hasCategoryFilterOptions,
  type CategoryFilterFacets,
} from '~/commerce/lib/category-facets'

import {
  ListingFiltersPanel,
  mergeDraftPriceInputs,
  useFilterDraftPriceState,
} from './ListingFiltersPanel'
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
  children: ReactNode
}

const SIDEBAR_WIDTH = 400

/** Etsy-style filters — left sidebar on desktop, bottom sheet elsewhere. */
export function ListingFiltersShell({
  filters,
  onApply,
  showTypeFilter = true,
  resultsLabel = 'Show results',
  facets,
  facetsLoading = false,
  inventoryDriven = false,
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
  const activeCount = countActiveFilters(filters)
  const showFilterButton =
    !inventoryDriven || (facets != null && hasCategoryFilterOptions(facets))

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
    setDraft({})
    setMinPrice('')
    setMaxPrice('')
    onApply({})
    close()
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
    <XStack alignItems="center" justifyContent="space-between" width="100%">
      <Text fontWeight="600" fontSize={18} color={ui.text}>
        Filters
      </Text>
      <XStack
        width={36}
        height={36}
        alignItems="center"
        justifyContent="center"
        borderRadius={999}
        cursor="pointer"
        hoverStyle={{ backgroundColor: ui.navHover }}
        onPress={close}
        aria-label="Close filters"
      >
        <Icons.X size={20} color={ui.text} />
      </XStack>
    </XStack>
  )

  return (
    <YStack gap="$4" width="100%">
      {showFilterButton ? (
        <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            backgroundColor={ui.surface}
            borderColor={ui.text}
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
                {panelHeader}
                <ScrollView flex={1} showsVerticalScrollIndicator>
                  <ListingFiltersPanel
                    draft={draft}
                    onChange={setDraft}
                    inventoryDriven={inventoryDriven}
                    facets={facets}
                    facetsLoading={facetsLoading}
                    showTypeFilter={showTypeFilter}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    onMinPriceChange={setMinPrice}
                    onMaxPriceChange={setMaxPrice}
                  />
                </ScrollView>
                {footer}
              </YStack>
            </YStack>
          </>
        ) : null
      ) : (
        <Sheet open={open} onOpenChange={setOpen} modal snapPointsMode="fit" dismissOnSnapToBottom>
          <SheetOverlay />
          <SheetFrame padding="$0">
            <YStack width="100%" gap="$3" paddingHorizontal="$4" paddingBottom="$4">
              <YStack paddingTop="$3" alignItems="center">
                <SheetHandle />
              </YStack>
              {panelHeader}
              <Sheet.ScrollView showsVerticalScrollIndicator width="100%">
                <ListingFiltersPanel
                  draft={draft}
                  onChange={setDraft}
                  inventoryDriven={inventoryDriven}
                  facets={facets}
                  facetsLoading={facetsLoading}
                  showTypeFilter={showTypeFilter}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  onMinPriceChange={setMinPrice}
                  onMaxPriceChange={setMaxPrice}
                />
              </Sheet.ScrollView>
              {footer}
            </YStack>
          </SheetFrame>
        </Sheet>
      )}
    </YStack>
  )
}