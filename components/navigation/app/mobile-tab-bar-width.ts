/** Bottom tab bar density from viewport width (web + native). */
export type BottomTabWidthTier = 'compact' | 'comfortable' | 'expanded'

/**
 * Max section tabs (excluding Home + You) per width tier.
 *
 * Phones are often ~360 logical px (e.g. Galaxy S20 FE @ 480dpi). Treat that as
 * able to fit three middle tabs (5 total with Home + You) — limiting compact to 2
 * hid Jobs / Calls / Join and looked like a broken 4-tab bar.
 */
export const BOTTOM_TAB_MIDDLE_LIMIT: Record<BottomTabWidthTier, number> = {
  compact: 3,
  comfortable: 3,
  expanded: 99,
}

export function getBottomTabWidthTier(width: number, gtSm: boolean): BottomTabWidthTier {
  if (gtSm || width >= 661) return 'expanded'
  // Comfortable from typical phone width up — reserve compact for very narrow.
  if (width >= 360) return 'comfortable'
  return 'compact'
}

export function shouldShowBottomTabLabels(_tier: BottomTabWidthTier) {
  // Always show captions — icon-only tabs confuse users on phones.
  return true
}

/**
 * Keep full tab titles on phones — abbreviations like "Shop" / "Net" confused
 * users who expect "Manage Shop" and "Network".
 */
export function formatBottomTabLabel(label: string, _tier: BottomTabWidthTier) {
  if (label === 'Manage shop') return 'Manage Shop'
  if (label === 'Create shop') return 'Create Shop'
  return label
}

export function limitMiddleTabsForWidth<T>(tabs: T[], tier: BottomTabWidthTier): T[] {
  const limit = BOTTOM_TAB_MIDDLE_LIMIT[tier]
  return tabs.slice(0, limit)
}
