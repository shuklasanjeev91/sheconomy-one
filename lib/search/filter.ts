/** Shared debounce interval for screen search bars (matches header omnibox). */
export const SEARCH_DEBOUNCE_MS = 250

/**
 * Minimum number of list items before a bottom-sheet picker shows an inline
 * search bar. Short lists (sort menus, small filter sets) stay search-free.
 */
export const SHEET_SEARCH_MIN_ITEMS = 10

/** True when any haystack part contains the trimmed query (case-insensitive). */
export function textMatchesQuery(
  query: string,
  ...parts: Array<string | null | undefined>
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = parts.filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(needle)
}

export function filterBySearchQuery<T>(
  items: T[],
  query: string,
  getParts: (item: T) => Array<string | null | undefined>,
): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  return items.filter((item) => textMatchesQuery(needle, ...getParts(item)))
}
