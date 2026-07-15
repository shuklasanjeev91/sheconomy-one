import { useGlobalSearchParams, usePathname } from 'one'

import {
  listingBrowseFiltersFromRouteParams,
  searchQueryFromRouteParams,
} from '~/commerce/lib/filters'
import { UnifiedSearchScreen } from '~/components/search'
import { searchScopeFromPath, searchScopeFromRouteParams } from '~/lib/search'

export default function SearchPage() {
  const params = useGlobalSearchParams() as Record<string, string | string[] | undefined>
  const pathname = usePathname()
  const scope =
    searchScopeFromRouteParams(params) ??
    (pathname.startsWith('/search') ? 'all' : searchScopeFromPath(pathname))

  return (
    <UnifiedSearchScreen
      query={searchQueryFromRouteParams(params)}
      scope={scope}
      filters={listingBrowseFiltersFromRouteParams(params)}
    />
  )
}
