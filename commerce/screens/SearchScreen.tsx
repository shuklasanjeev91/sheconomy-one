import type { ListingBrowseFilters } from '~/commerce/lib/filters'
import { UnifiedSearchScreen } from '~/components/search'

type SearchScreenProps = {
  query?: string
  filters?: ListingBrowseFilters
}

/** @deprecated Prefer `UnifiedSearchScreen` — kept for commerce-only callers. */
export function SearchScreen({ query = '', filters = {} }: SearchScreenProps) {
  return <UnifiedSearchScreen query={query} scope="listings" filters={filters} />
}
