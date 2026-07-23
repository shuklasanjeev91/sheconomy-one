/** Bottom tab bar density from viewport width (web + native). */
export type BottomTabWidthTier = 'compact' | 'comfortable' | 'expanded'

/** Max section tabs (excluding Home, Cart, You) per width tier. */
export const BOTTOM_TAB_MIDDLE_LIMIT: Record<BottomTabWidthTier, number> = {
  compact: 2,
  comfortable: 3,
  expanded: 99,
}

export function getBottomTabWidthTier(width: number, gtSm: boolean): BottomTabWidthTier {
  if (gtSm || width >= 661) return 'expanded'
  if (width >= 390) return 'comfortable'
  return 'compact'
}

export function shouldShowBottomTabLabels(_tier: BottomTabWidthTier) {
  // Always show captions — icon-only tabs confuse users on phones.
  return true
}

export function formatBottomTabLabel(label: string, tier: BottomTabWidthTier) {
  if (tier === 'expanded') return label

  const short: Record<string, string> = {
    'Manage shop': 'Shop',
    'Create shop': 'Create',
    'Create Post': 'Post',
    'New chat': 'New',
    Network: 'Net',
    Groups: 'Groups',
    Events: 'Events',
    Meetings: 'Meet',
    Schedule: 'Sched',
  }

  if (tier === 'compact') {
    return short[label] ?? (label.length > 6 ? `${label.slice(0, 5)}…` : label)
  }

  return short[label] ?? label
}

export function limitMiddleTabsForWidth<T>(tabs: T[], tier: BottomTabWidthTier): T[] {
  const limit = BOTTOM_TAB_MIDDLE_LIMIT[tier]
  return tabs.slice(0, limit)
}
