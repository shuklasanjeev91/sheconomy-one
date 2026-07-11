import { useEffect, useState } from 'react'

import { Icons, Separator, Spinner, Text, XStack, YStack } from '~/components/ui'
import {
  LISTING_SORT_OPTIONS,
  LISTING_TYPE_OPTIONS,
  RATING_FILTER_OPTIONS,
  toggleFilterId,
  toggleVariantFilter,
  type ListingBrowseFilters,
  type ListingSort,
} from '~/commerce/lib/filters'
import {
  getAvailableSortOptions,
  type CategoryFilterFacets,
} from '~/commerce/lib/category-facets'
import type { ListingTypeFilter } from '~/lib/supabase/commerce'

import { PriceRangeSlider } from './PriceRangeSlider'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingFiltersPanelProps = {
  draft: ListingBrowseFilters
  onChange: (next: ListingBrowseFilters) => void
  /** When true, only render options derived from category inventory facets. */
  inventoryDriven?: boolean
  facets?: CategoryFilterFacets | null
  facetsLoading?: boolean
  showTypeFilter?: boolean
  showSort?: boolean
  minPrice: string
  maxPrice: string
  onMinPriceChange: (value: string) => void
  onMaxPriceChange: (value: string) => void
}

/** Filter sections driven by available category inventory. */
export function ListingFiltersPanel({
  draft,
  onChange,
  inventoryDriven = false,
  facets,
  facetsLoading = false,
  showTypeFilter = true,
  showSort = true,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
}: ListingFiltersPanelProps) {
  const ui = useAppUi()
  const priceBounds = facets?.priceRange
  const sliderMin = minPrice.trim()
    ? Number(minPrice)
    : (draft.minPrice ?? priceBounds?.min ?? 0)
  const sliderMax = maxPrice.trim()
    ? Number(maxPrice)
    : (draft.maxPrice ?? priceBounds?.max ?? 0)

  function patch(next: Partial<ListingBrowseFilters>) {
    onChange({ ...draft, ...next })
  }

  if (inventoryDriven && facetsLoading) {
    return (
      <YStack paddingVertical="$6" alignItems="center">
        <Spinner size="small" />
      </YStack>
    )
  }

  if (inventoryDriven && (!facets || facets.totalListings === 0)) {
    return (
      <Text fontSize={14} color={ui.textMuted}>
        No filter options for this category yet.
      </Text>
    )
  }

  const sortOptions = inventoryDriven && facets
    ? getAvailableSortOptions(facets)
    : LISTING_SORT_OPTIONS

  const showPriceFilter =
    inventoryDriven && facets
      ? facets.totalListings > 0 && facets.priceRange.max > facets.priceRange.min
      : priceBounds != null && priceBounds.max > priceBounds.min

  const showListingTypes =
    inventoryDriven && facets
      ? facets.listingTypes.length > 1
      : showTypeFilter

  const listingTypeOptions =
    inventoryDriven && facets
      ? facets.listingTypes.map((row) => ({
          value: row.type,
          label: row.label,
          count: row.count,
        }))
      : LISTING_TYPE_OPTIONS.filter((option) => option.value !== 'all').map((option) => ({
          value: option.value as ListingTypeFilter,
          label: option.label,
        }))

  const showShops = inventoryDriven && facets ? facets.shops.length > 1 : false

  return (
    <YStack gap="$5" width="100%">
      {showSort && sortOptions.length > 0 ? (
        <FilterSection title="Sort by">
          {sortOptions.map((option) => (
            <FilterOption
              key={option.value}
              label={option.label}
              selected={(draft.sort ?? 'relevance') === option.value}
              onPress={() => patch({ sort: option.value as ListingSort })}
            />
          ))}
        </FilterSection>
      ) : null}

      {inventoryDriven && facets && facets.subcategories.length > 0 ? (
        <>
          <Separator borderColor={ui.panelBorder} />
          <FilterSection title="Category">
            {facets.subcategories.map((subcategory) => (
              <FilterCheckbox
                key={subcategory.categoryId}
                label={subcategory.name}
                count={subcategory.count}
                selected={draft.categoryIds?.includes(subcategory.categoryId) ?? false}
                onPress={() =>
                  patch({
                    categoryIds: toggleFilterId(draft.categoryIds, subcategory.categoryId),
                  })
                }
              />
            ))}
          </FilterSection>
        </>
      ) : null}

      {showListingTypes ? (
        <>
          <Separator borderColor={ui.panelBorder} />
          <FilterSection title="Item type">
            {!inventoryDriven ? (
              <FilterOption
                label="All items"
                selected={!draft.listingType}
                onPress={() => patch({ listingType: undefined })}
              />
            ) : null}
            {listingTypeOptions.map((option) => (
              <FilterCheckbox
                key={option.value}
                label={option.label}
                count={'count' in option ? option.count : undefined}
                selected={draft.listingType === option.value}
                onPress={() =>
                  patch({
                    listingType:
                      draft.listingType === option.value
                        ? undefined
                        : (option.value as ListingTypeFilter),
                  })
                }
              />
            ))}
          </FilterSection>
        </>
      ) : null}

      {showPriceFilter && priceBounds ? (
        <>
          <Separator borderColor={ui.panelBorder} />
          <FilterSection title="Price">
            <PriceRangeSlider
              min={priceBounds.min}
              max={priceBounds.max}
              valueMin={sliderMin}
              valueMax={sliderMax}
              onChange={(low, high) => {
                onMinPriceChange(String(low))
                onMaxPriceChange(String(high))
                patch({ minPrice: low, maxPrice: high })
              }}
            />
          </FilterSection>
        </>
      ) : null}

      {inventoryDriven && facets && facets.onSaleCount > 0 ? (
        <>
          <Separator borderColor={ui.panelBorder} />
          <FilterSection title="Offers">
            <FilterCheckbox
              label="On sale"
              count={facets.onSaleCount}
              selected={draft.onSale === true}
              onPress={() => patch({ onSale: draft.onSale ? undefined : true })}
            />
          </FilterSection>
        </>
      ) : null}

      {inventoryDriven &&
        facets?.variants.map((group) => (
          <YStack key={group.name} gap="$2" width="100%">
            <Separator borderColor={ui.panelBorder} />
            <FilterSection title={group.name}>
              {group.options.map((option) => (
                <FilterCheckbox
                  key={`${group.name}-${option.value}`}
                  label={option.label}
                  count={option.count}
                  selected={draft.variants?.[group.name]?.includes(option.value) ?? false}
                  onPress={() =>
                    patch({
                      variants: toggleVariantFilter(draft.variants, group.name, option.value),
                    })
                  }
                />
              ))}
            </FilterSection>
          </YStack>
        ))}

      {inventoryDriven && facets && facets.ratingBuckets.length > 0 ? (
        <>
          <Separator borderColor={ui.panelBorder} />
          <FilterSection title="Customer rating">
            {facets.ratingBuckets.map((option) => {
              const minRating = Number(option.value)
              const selected = draft.minRating === minRating
              return (
                <FilterOption
                  key={option.value}
                  label={
                    <XStack gap="$2" alignItems="center">
                      <StarRating min={minRating} />
                      <Text fontSize={14} color={ui.text}>
                        ({option.count})
                      </Text>
                    </XStack>
                  }
                  selected={selected}
                  onPress={() =>
                    patch({
                      minRating: selected ? undefined : minRating,
                    })
                  }
                />
              )
            })}
          </FilterSection>
        </>
      ) : null}

      {showShops && facets ? (
        <>
          <Separator borderColor={ui.panelBorder} />
          <FilterSection title="Shop">
            {facets.shops.map((shop) => (
              <FilterCheckbox
                key={shop.shopId}
                label={shop.name}
                count={shop.count}
                selected={draft.shopIds?.includes(shop.shopId) ?? false}
                onPress={() =>
                  patch({
                    shopIds: toggleFilterId(draft.shopIds, shop.shopId),
                  })
                }
              />
            ))}
          </FilterSection>
        </>
      ) : null}

      {!inventoryDriven ? (
        <>
          <Separator borderColor={ui.panelBorder} />
          <FilterSection title="Customer rating">
            {RATING_FILTER_OPTIONS.map((option) => {
              const selected =
                option.value === 'all'
                  ? !draft.minRating
                  : draft.minRating === option.value
              return (
                <FilterOption
                  key={String(option.value)}
                  label={option.label}
                  selected={selected}
                  onPress={() =>
                    patch({
                      minRating: option.value === 'all' ? undefined : option.value,
                    })
                  }
                />
              )
            })}
          </FilterSection>
        </>
      ) : null}
    </YStack>
  )
}

function StarRating({ min }: { min: number }) {
  const ui = useAppUi()

  return (
    <XStack gap={2} alignItems="center">
      {Array.from({ length: 5 }).map((_, index) => (
        <Icons.Star
          key={index}
          size={14}
          color={index < min ? ui.starFill : ui.starEmpty}
          fill={index < min ? ui.starFill : 'transparent'}
        />
      ))}
      <Text fontSize={13} color={ui.textSecondary} marginLeft={4}>
        & up
      </Text>
    </XStack>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const ui = useAppUi()

  return (
    <YStack gap="$2" width="100%">
      <Text fontWeight="600" fontSize={14} color={ui.text}>
        {title}
      </Text>
      <YStack gap={2}>{children}</YStack>
    </YStack>
  )
}

function FilterOption({
  label,
  selected,
  onPress,
}: {
  label: React.ReactNode
  selected: boolean
  onPress: () => void
}) {
  const ui = useAppUi()

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingVertical="$2.5"
      paddingHorizontal="$1"
      cursor="pointer"
      onPress={onPress}
      hoverStyle={{ backgroundColor: ui.surfaceMuted }}
      borderRadius={6}
    >
      {typeof label === 'string' ? (
        <Text fontSize={14} color={ui.text} fontWeight={selected ? '600' : '400'}>
          {label}
        </Text>
      ) : (
        label
      )}
      {selected ? <Icons.Check size={16} color={ui.text} strokeWidth={2.5} /> : null}
    </XStack>
  )
}

function FilterCheckbox({
  label,
  count,
  selected,
  onPress,
}: {
  label: string
  count?: number
  selected: boolean
  onPress: () => void
}) {
  const ui = useAppUi()

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingVertical="$2.5"
      paddingHorizontal="$1"
      cursor="pointer"
      onPress={onPress}
      hoverStyle={{ backgroundColor: ui.surfaceMuted }}
      borderRadius={6}
      gap="$3"
    >
      <XStack gap="$2" alignItems="center" flex={1}>
        <XStack
          width={18}
          height={18}
          borderRadius={4}
          borderWidth={1.5}
          borderColor={selected ? ui.text : ui.borderSubtle}
          backgroundColor={selected ? ui.text : ui.surface}
          alignItems="center"
          justifyContent="center"
        >
          {selected ? <Icons.Check size={12} color={ui.onBrand} strokeWidth={3} /> : null}
        </XStack>
        <Text fontSize={14} color={ui.text} fontWeight={selected ? '600' : '400'} flex={1}>
          {label}
        </Text>
      </XStack>
      {count != null ? (
        <Text fontSize={13} color={ui.textMuted}>
          ({count})
        </Text>
      ) : null}
    </XStack>
  )
}

/** Sync draft price fields when applying from shell footer. */
export function mergeDraftPriceInputs(
  draft: ListingBrowseFilters,
  minPrice: string,
  maxPrice: string,
): ListingBrowseFilters {
  return {
    ...draft,
    minPrice: minPrice.trim() ? Number(minPrice) : undefined,
    maxPrice: maxPrice.trim() ? Number(maxPrice) : undefined,
  }
}

export function useFilterDraftPriceState(
  draft: ListingBrowseFilters,
  bounds?: { min: number; max: number },
) {
  const [minPrice, setMinPrice] = useState(
    draft.minPrice != null
      ? String(draft.minPrice)
      : bounds
        ? String(bounds.min)
        : '',
  )
  const [maxPrice, setMaxPrice] = useState(
    draft.maxPrice != null
      ? String(draft.maxPrice)
      : bounds
        ? String(bounds.max)
        : '',
  )

  useEffect(() => {
    setMinPrice(draft.minPrice != null ? String(draft.minPrice) : bounds ? String(bounds.min) : '')
    setMaxPrice(draft.maxPrice != null ? String(draft.maxPrice) : bounds ? String(bounds.max) : '')
  }, [draft.minPrice, draft.maxPrice, bounds?.min, bounds?.max])

  return { minPrice, maxPrice, setMinPrice, setMaxPrice }
}