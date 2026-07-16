import { AppSearchField } from '~/components/search'

type NavSearchBarProps = {
  compact?: boolean
  placeholder?: string
  initialQuery?: string
}

/**
 * Legacy export — thin wrapper around the unified omnibox
 * (web + iOS + Android).
 */
export function NavSearchBar({ compact, initialQuery = '' }: NavSearchBarProps) {
  return <AppSearchField compact={compact} initialQuery={initialQuery} />
}
