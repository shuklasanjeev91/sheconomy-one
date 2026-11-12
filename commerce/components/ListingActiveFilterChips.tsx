import { Icons, Text, XStack } from '~/components/ui'
import {
  LISTING_SORT_OPTIONS,
  LISTING_TYPE_OPTIONS,
  RATING_FILTER_OPTIONS,
  type ListingBrowseFilters,
} from '~/commerce/lib/filters'
import type { CategoryFilterFacets } from '~/commerce/lib/category-facets'
import { formatCurrency } from '~/lib/format'
import { useAppUi } from '~/lib/theme/useAppUi'

type Chip = {
  id: string
  label: string
  onRemove: () => void
}

type ListingActiveFilterChipsProps = {
  filters: ListingBrowseFilters
  onChange: (next: ListingBrowseFilters) => void
  facets?: CategoryFilterFacets | null
  /** When true, sort is controlled by the toolbar — hide sort chips. */
  excludeSort?: boolean
}

function ChipPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  const ui = useAppUi()
  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      paddingHorizontal="$2.5"
      paddingVertical={7}
      borderRadius={999}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      cursor="pointer"
      hoverStyle={{ borderColor: ui.brand }}
      pressStyle={{ opacity: 0.85 }}
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`Remove filter ${label}`}
    >
      <Text fontSize={12} fontWeight="600" color={ui.text} numberOfLines={1}>
        {label}
      </Text>
      <Icons.X size={12} color={ui.textSecondary} />
    </XStack>
  )
}

/** Removable chips for active listing browse filters (category / search PLP). */
export function ListingActiveFilterChips({
  filters,
  onChange,
  facets,
  excludeSort = false,
}: ListingActiveFilterChipsProps) {
  const chips: Chip[] = []

  if (filters.listingType) {
    const label =
      LISTING_TYPE_OPTIONS.find((option) => option.value === filters.listingType)?.label ??
      filters.listingType
    chips.push({
      id: `type:${filters.listingType}`,
      label,
      onRemove: () => onChange({ ...filters, listingType: undefined }),
    })
  }

  if (filters.onSale) {
    chips.push({
      id: 'sale',
      label: 'On sale',
      onRemove: () => onChange({ ...filters, onSale: undefined }),
    })
  }

  if (filters.minPrice != null || filters.maxPrice != null) {
    const min = filters.minPrice != null ? formatCurrency(filters.minPrice, 'INR') : null
    const max = filters.maxPrice != null ? formatCurrency(filters.maxPrice, 'INR') : null
    const label = min && max ? `${min} – ${max}` : min ? `From ${min}` : `Up to ${max}`
    chips.push({
      id: 'price',
      label,
      onRemove: () => onChange({ ...filters, minPrice: undefined, maxPrice: undefined }),
    })
  }

  if (filters.minRating != null) {
    const label =
      RATING_FILTER_OPTIONS.find((option) => option.value === filters.minRating)?.label ??
      `${filters.minRating}+ stars`
    chips.push({
      id: `rating:${filters.minRating}`,
      label,
      onRemove: () => onChange({ ...filters, minRating: undefined }),
    })
  }

  if (!excludeSort && filters.sort && filters.sort !== 'relevance') {
    const label =
      LISTING_SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ?? filters.sort
    chips.push({
      id: `sort:${filters.sort}`,
      label,
      onRemove: () => onChange({ ...filters, sort: undefined }),
    })
  }

  for (const categoryId of filters.categoryIds ?? []) {
    const match = facets?.subcategories.find((item) => item.categoryId === categoryId)
    chips.push({
      id: `cat:${categoryId}`,
      label: match?.name ?? 'Category',
      onRemove: () =>
        onChange({
          ...filters,
          categoryIds: (filters.categoryIds ?? []).filter((id) => id !== categoryId),
        }),
    })
  }

  for (const shopId of filters.shopIds ?? []) {
    const match = facets?.shops.find((item) => item.shopId === shopId)
    chips.push({
      id: `shop:${shopId}`,
      label: match?.name ?? 'Shop',
      onRemove: () =>
        onChange({
          ...filters,
          shopIds: (filters.shopIds ?? []).filter((id) => id !== shopId),
        }),
    })
  }

  if (filters.variants) {
    for (const [name, values] of Object.entries(filters.variants)) {
      for (const value of values) {
        chips.push({
          id: `v:${name}:${value}`,
          label: `${name}: ${value}`,
          onRemove: () => {
            const nextValues = (filters.variants?.[name] ?? []).filter((item) => item !== value)
            const nextVariants = { ...(filters.variants ?? {}) }
            if (nextValues.length) nextVariants[name] = nextValues
            else delete nextVariants[name]
            onChange({
              ...filters,
              variants: Object.keys(nextVariants).length ? nextVariants : undefined,
            })
          },
        })
      }
    }
  }

  if (!chips.length) return null

  return (
    <XStack width="100%" gap="$2" flexWrap="wrap" alignItems="center">
      {chips.map((chip) => (
        <ChipPill key={chip.id} label={chip.label} onRemove={chip.onRemove} />
      ))}
    </XStack>
  )
}
