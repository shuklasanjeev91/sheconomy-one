import { useMemo, useState, type ReactNode } from 'react'

import {
  DEFAULT_SHOP_BROWSE_FILTERS,
  SHOP_SORT_OPTIONS,
  countActiveShopFilters,
  type ShopBrowseFilters,
  type ShopSortOption,
} from '~/commerce/lib/shop-filters'
import { GeoSearchSheet } from '~/components/geo/GeoSearchSheet'
import { OptionSearchSheet } from '~/components/search/OptionSearchSheet'
import { getCountryName } from '~/lib/geo'
import type { GeoOption } from '~/lib/geo'
import {
  Button,
  Icons,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type ShopFiltersBarProps = {
  filters: ShopBrowseFilters
  countries: string[]
  resultCount: number
  onChange: (filters: ShopBrowseFilters) => void
}

export function ShopFiltersBar({ filters, countries, resultCount, onChange }: ShopFiltersBarProps) {
  const ui = useAppUi()
  const activeCount = countActiveShopFilters(filters)
  const [countryOpen, setCountryOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  const countryOptions = useMemo<GeoOption[]>(
    () => [
      { value: 'all', label: 'All countries' },
      ...countries.map((country) => ({
        value: country,
        label: getCountryName(country, country),
      })),
    ],
    [countries],
  )
  const selectedCountryLabel =
    countryOptions.find((option) => option.value === filters.country)?.label ?? 'All countries'
  const selectedSortLabel =
    SHOP_SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ?? 'Sort shops'

  function patch(next: Partial<ShopBrowseFilters>) {
    onChange({ ...filters, ...next })
  }

  return (
    <YStack
      gap="$3"
      width="100%"
      padding="$4"
      borderRadius={16}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <XStack gap="$2" alignItems="center">
          <Icons.SlidersHorizontal size={16} color={ui.brand} />
          <Text fontSize={14} fontWeight="700" color={ui.text}>
            Filter shops
          </Text>
          {activeCount > 0 ? (
            <Text fontSize={12} fontWeight="600" color={ui.brand}>
              {activeCount} active
            </Text>
          ) : null}
        </XStack>
        <Text fontSize={13} color={ui.textSecondary} fontWeight="500">
          {resultCount} shop{resultCount === 1 ? '' : 's'}
        </Text>
      </XStack>

      <XStack gap="$3" flexWrap="wrap" alignItems="flex-end" width="100%">
        <FilterField label="Sort by" flex={1} minWidth={200}>
          <XStack
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
            paddingHorizontal="$3"
            paddingVertical="$2.5"
            borderRadius={12}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            onPress={() => setSortOpen(true)}
          >
            <Text flex={1} fontSize={14} color={ui.text} numberOfLines={1}>
              {selectedSortLabel}
            </Text>
            <Icons.ChevronDown size={16} color={ui.textMuted} />
          </XStack>
          <OptionSearchSheet
            open={sortOpen}
            onOpenChange={setSortOpen}
            title="Sort shops"
            options={SHOP_SORT_OPTIONS}
            value={filters.sort}
            onSelect={(value) => patch({ sort: value as ShopSortOption })}
            searchPlaceholder="Search sort options"
          />
        </FilterField>

        <FilterField label="Country" flex={1} minWidth={200}>
          <XStack
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
            paddingHorizontal="$3"
            paddingVertical="$2.5"
            borderRadius={12}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            onPress={() => setCountryOpen(true)}
          >
            <Text flex={1} fontSize={14} color={ui.text} numberOfLines={1}>
              {selectedCountryLabel}
            </Text>
            <Icons.ChevronDown size={16} color={ui.textMuted} />
          </XStack>
          <GeoSearchSheet
            open={countryOpen}
            onOpenChange={setCountryOpen}
            title="Country"
            options={countryOptions}
            value={filters.country}
            onSelect={(option) => patch({ country: option.value })}
            searchPlaceholder="Search countries"
          />
        </FilterField>

        <Button
          tone={filters.followingOnly ? 'primary' : 'outline'}
          size="$3"
          borderRadius={999}
          onPress={() => patch({ followingOnly: !filters.followingOnly })}
          icon={<Icons.Heart size={14} />}
        >
          Following
        </Button>

        {activeCount > 0 ? (
          <Button
            tone="ghost"
            size="$3"
            borderRadius={999}
            onPress={() => onChange(DEFAULT_SHOP_BROWSE_FILTERS)}
          >
            Reset
          </Button>
        ) : null}
      </XStack>
    </YStack>
  )
}

function FilterField({
  label,
  children,
  flex,
  minWidth,
}: {
  label: string
  children: ReactNode
  flex?: number
  minWidth?: number
}) {
  const ui = useAppUi()

  return (
    <YStack gap="$1.5" flex={flex} minWidth={minWidth}>
      <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
        {label}
      </Text>
      {children}
    </YStack>
  )
}
