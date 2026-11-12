/** Kept in sync with `ListingGrid`'s `columns` prop. */
export type ListingGridColumns = 2 | 3 | 4 | 5 | 6

/**
 * Product grid density from the **available content width** (not the full
 * viewport). Category/search pages with a filter sidebar are narrower than the
 * window, so using viewport breakpoints alone packs 5–6 tiny cards into a
 * half-width column.
 *
 * Targets roughly 200–260px cards with gutters — marketplace PLP rhythm.
 */
export function listingGridColumnsForWidth(width: number): ListingGridColumns {
  if (!Number.isFinite(width) || width <= 0) return 2
  if (width >= 1280) return 5
  if (width >= 1000) return 4
  if (width >= 720) return 3
  if (width >= 400) return 2
  return 2
}
