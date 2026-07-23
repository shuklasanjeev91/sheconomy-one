import type { ShopSummary } from '~/commerce/lib/commerce'
import { getCountryName } from '~/lib/geo'

export type ShopSortOption =
  | 'name_asc'
  | 'name_desc'
  | 'rating_high'
  | 'rating_low'
  | 'country_asc'
  | 'country_desc'

export type ShopBrowseFilters = {
  sort: ShopSortOption
  country: string
  /** When true, only shops the signed-in user follows. */
  followingOnly: boolean
}

export const DEFAULT_SHOP_BROWSE_FILTERS: ShopBrowseFilters = {
  sort: 'rating_high',
  country: 'all',
  followingOnly: false,
}

export const SHOP_SORT_OPTIONS: { value: ShopSortOption; label: string }[] = [
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'rating_high', label: 'Rating (high to low)' },
  { value: 'rating_low', label: 'Rating (low to high)' },
  { value: 'country_asc', label: 'Country (A–Z)' },
  { value: 'country_desc', label: 'Country (Z–A)' },
]

export function getShopCountryLabel(shop: ShopSummary) {
  const raw = shop.country?.trim()
  if (!raw) return 'Unknown'
  return getCountryName(raw, raw)
}

/** Unique raw country values (codes/names) for server-side browse filters. */
export function extractShopCountries(shops: ShopSummary[]) {
  const countries = new Set<string>()
  for (const shop of shops) {
    const raw = shop.country?.trim()
    if (raw) countries.add(raw)
  }
  return Array.from(countries).sort((a, b) =>
    getCountryName(a, a).localeCompare(getCountryName(b, b)),
  )
}

export function applyShopBrowseFilters(shops: ShopSummary[], filters: ShopBrowseFilters) {
  const filtered =
    filters.country === 'all'
      ? shops
      : shops.filter((shop) => {
          const raw = shop.country?.trim()
          return raw === filters.country || getShopCountryLabel(shop) === filters.country
        })

  const sorted = [...filtered]

  switch (filters.sort) {
    case 'name_asc':
      sorted.sort((a, b) => a.shop_name.localeCompare(b.shop_name))
      break
    case 'name_desc':
      sorted.sort((a, b) => b.shop_name.localeCompare(a.shop_name))
      break
    case 'rating_high':
      sorted.sort(
        (a, b) =>
          (b.average_rating ?? 0) - (a.average_rating ?? 0) ||
          (b.total_reviews ?? 0) - (a.total_reviews ?? 0),
      )
      break
    case 'rating_low':
      sorted.sort(
        (a, b) =>
          (a.average_rating ?? 0) - (b.average_rating ?? 0) ||
          (a.total_reviews ?? 0) - (b.total_reviews ?? 0),
      )
      break
    case 'country_asc':
      sorted.sort(
        (a, b) =>
          getShopCountryLabel(a).localeCompare(getShopCountryLabel(b)) ||
          a.shop_name.localeCompare(b.shop_name),
      )
      break
    case 'country_desc':
      sorted.sort(
        (a, b) =>
          getShopCountryLabel(b).localeCompare(getShopCountryLabel(a)) ||
          a.shop_name.localeCompare(b.shop_name),
      )
      break
  }

  return sorted
}

export function countActiveShopFilters(filters: ShopBrowseFilters) {
  let count = 0
  if (filters.sort !== DEFAULT_SHOP_BROWSE_FILTERS.sort) count += 1
  if (filters.country !== 'all') count += 1
  if (filters.followingOnly) count += 1
  return count
}
