import type { ListingTypeFilter } from '~/lib/supabase/commerce'

export type ListingSort = 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating'

export type VariantFilters = Record<string, string[]>

export type ListingBrowseFilters = {
  listingType?: ListingTypeFilter
  minPrice?: number
  maxPrice?: number
  minRating?: number
  sort?: ListingSort
  categoryIds?: string[]
  shopIds?: string[]
  variants?: VariantFilters
  onSale?: boolean
}

export const LISTING_SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
]

export const LISTING_TYPE_OPTIONS: { value: ListingTypeFilter | 'all'; label: string }[] = [
  { value: 'all', label: 'All items' },
  { value: 'physical', label: 'Ships to you' },
  { value: 'digital', label: 'Instant delivery' },
]

export const RATING_FILTER_OPTIONS: { value: number | 'all'; label: string }[] = [
  { value: 'all', label: 'Any rating' },
  { value: 4, label: '4+ stars' },
  { value: 3, label: '3+ stars' },
]

function parseCsvParam(value: string | null): string[] | undefined {
  if (!value?.trim()) return undefined
  const items = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return items.length ? items : undefined
}

function parseVariantParam(value: string | null): VariantFilters | undefined {
  if (!value?.trim()) return undefined

  const variants: VariantFilters = {}

  for (const group of value.split(';')) {
    const separator = group.indexOf(':')
    if (separator <= 0) continue

    const name = decodeURIComponent(group.slice(0, separator))
    const values = group
      .slice(separator + 1)
      .split(',')
      .map((part) => decodeURIComponent(part.trim()))
      .filter(Boolean)

    if (name && values.length) {
      variants[name] = values
    }
  }

  return Object.keys(variants).length ? variants : undefined
}

function buildVariantParam(variants?: VariantFilters): string | undefined {
  if (!variants) return undefined

  const parts = Object.entries(variants)
    .filter(([, values]) => values.length > 0)
    .map(
      ([name, values]) =>
        `${encodeURIComponent(name)}:${values.map((value) => encodeURIComponent(value)).join(',')}`,
    )

  return parts.length ? parts.join(';') : undefined
}

export function parseListingBrowseFilters(params: URLSearchParams): ListingBrowseFilters {
  const listingType = params.get('type')
  const minPrice = params.get('min')
  const maxPrice = params.get('max')
  const minRating = params.get('rating')
  const sort = params.get('sort')

  return {
    listingType:
      listingType === 'physical' || listingType === 'digital' ? listingType : undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
    sort: isListingSort(sort) ? sort : undefined,
    categoryIds: parseCsvParam(params.get('cats')),
    shopIds: parseCsvParam(params.get('shops')),
    variants: parseVariantParam(params.get('v')),
    onSale: params.get('sale') === '1' ? true : undefined,
  }
}

type RouteSearchParams = Record<string, string | string[] | undefined | null>

/** Parse browse filters from expo-router / one global search params (client-safe). */
export function listingBrowseFiltersFromRouteParams(
  params: RouteSearchParams,
  options?: { exclude?: string[] },
): ListingBrowseFilters {
  const exclude = new Set(options?.exclude ?? [])
  const searchParts = Object.entries(params).flatMap(([key, value]) => {
    if (value == null || exclude.has(key)) return []
    const values = Array.isArray(value) ? value : [value]
    return values.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
  })

  return parseListingBrowseFilters(new URLSearchParams(searchParts.join('&')))
}

export function searchQueryFromRouteParams(params: RouteSearchParams): string {
  const value = params.q
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value[0] ?? ''
  return ''
}

export function buildFilterSearchParams(
  base: URLSearchParams,
  filters: ListingBrowseFilters,
): URLSearchParams {
  const next = new URLSearchParams(base)

  if (filters.listingType) next.set('type', filters.listingType)
  else next.delete('type')

  if (filters.minPrice != null && !Number.isNaN(filters.minPrice)) {
    next.set('min', String(filters.minPrice))
  } else {
    next.delete('min')
  }

  if (filters.maxPrice != null && !Number.isNaN(filters.maxPrice)) {
    next.set('max', String(filters.maxPrice))
  } else {
    next.delete('max')
  }

  if (filters.minRating != null && !Number.isNaN(filters.minRating)) {
    next.set('rating', String(filters.minRating))
  } else {
    next.delete('rating')
  }

  if (filters.sort && filters.sort !== 'relevance') next.set('sort', filters.sort)
  else next.delete('sort')

  if (filters.categoryIds?.length) next.set('cats', filters.categoryIds.join(','))
  else next.delete('cats')

  if (filters.shopIds?.length) next.set('shops', filters.shopIds.join(','))
  else next.delete('shops')

  const variantParam = buildVariantParam(filters.variants)
  if (variantParam) next.set('v', variantParam)
  else next.delete('v')

  if (filters.onSale) next.set('sale', '1')
  else next.delete('sale')

  return next
}

export function isListingSort(value: string | null | undefined): value is ListingSort {
  return (
    value === 'relevance' ||
    value === 'newest' ||
    value === 'price_asc' ||
    value === 'price_desc' ||
    value === 'rating'
  )
}

export function sortListings<T extends { price: number; average_rating: number | null }>(
  items: T[],
  sort: ListingSort = 'relevance',
): T[] {
  const sorted = [...items]

  switch (sort) {
    case 'price_asc':
      return sorted.sort((a, b) => a.price - b.price)
    case 'price_desc':
      return sorted.sort((a, b) => b.price - a.price)
    case 'rating':
      return sorted.sort(
        (a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0),
      )
    case 'newest':
    case 'relevance':
    default:
      return sorted
  }
}

export function getListingOrderColumn(sort: ListingSort = 'newest') {
  switch (sort) {
    case 'price_asc':
      return { column: 'price' as const, ascending: true }
    case 'price_desc':
      return { column: 'price' as const, ascending: false }
    case 'rating':
      return { column: 'average_rating' as const, ascending: false, nullsFirst: false }
    case 'relevance':
    case 'newest':
    default:
      return { column: 'created_at' as const, ascending: false }
  }
}

export function countActiveFilters(filters: ListingBrowseFilters): number {
  let count = 0
  if (filters.listingType) count += 1
  if (filters.minPrice != null || filters.maxPrice != null) count += 1
  if (filters.minRating != null) count += 1
  if (filters.sort && filters.sort !== 'relevance') count += 1
  if (filters.categoryIds?.length) count += 1
  if (filters.shopIds?.length) count += 1
  if (filters.onSale) count += 1
  if (filters.variants) {
    count += Object.values(filters.variants).filter((values) => values.length > 0).length
  }
  return count
}

export function hasActiveFilters(filters: ListingBrowseFilters): boolean {
  return countActiveFilters(filters) > 0
}

export function toggleFilterId(
  current: string[] | undefined,
  id: string,
): string[] | undefined {
  const set = new Set(current ?? [])
  if (set.has(id)) set.delete(id)
  else set.add(id)
  const next = [...set]
  return next.length ? next : undefined
}

export function toggleVariantFilter(
  current: VariantFilters | undefined,
  name: string,
  value: string,
): VariantFilters | undefined {
  const next: VariantFilters = { ...(current ?? {}) }
  const selected = new Set(next[name] ?? [])

  if (selected.has(value)) selected.delete(value)
  else selected.add(value)

  const values = [...selected]
  if (values.length) next[name] = values
  else delete next[name]

  return Object.keys(next).length ? next : undefined
}
