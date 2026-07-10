import { useMemo, type ReactNode } from 'react'

import {
  DEFAULT_SHOP_BROWSE_FILTERS,
  SHOP_SORT_OPTIONS,
  countActiveShopFilters,
  type ShopBrowseFilters,
  type ShopSortOption,
} from '~/commerce/lib/shop-filters'
import {
  Button,
  Icons,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
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

  const countryOptions = useMemo(
    () => [{ value: 'all', label: 'All countries' }, ...countries.map((country) => ({ value: country, label: country }))],
    [countries],
  )

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
          <Select
            value={filters.sort}
            onValueChange={(value) => patch({ sort: value as ShopSortOption })}
          >
            <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={16} />}>
              <Select.Value placeholder="Sort shops" />
            </SelectTrigger>
            <SelectContent zIndex={300000}>
              <SelectViewport>
                {SHOP_SORT_OPTIONS.map((option, index) => (
                  <SelectItem key={option.value} index={index} value={option.value}>
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </SelectItem>
                ))}
              </SelectViewport>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Country" flex={1} minWidth={200}>
          <Select
            value={filters.country}
            onValueChange={(value) => patch({ country: value })}
          >
            <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={16} />}>
              <Select.Value placeholder="All countries" />
            </SelectTrigger>
            <SelectContent zIndex={300000}>
              <SelectViewport>
                {countryOptions.map((option, index) => (
                  <SelectItem key={option.value} index={index} value={option.value}>
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </SelectItem>
                ))}
              </SelectViewport>
            </SelectContent>
          </Select>
        </FilterField>

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
