import { useGlobalSearchParams, usePathname } from 'one'

import {
  listingBrowseFiltersFromRouteParams,
  searchModeFromRouteParams,
  searchQueryFromRouteParams,
} from '~/commerce/lib/filters'
import { UnifiedSearchScreen } from '~/components/search'
import { searchScopeFromPath, searchScopeFromRouteParams } from '~/lib/search'

export default function SearchPage() {
  const params = useGlobalSearchParams() as Record<string, string | string[] | undefined>
  const pathname = usePathname()
  const mode = searchModeFromRouteParams(params)
  const scope =
    mode === 'ai'
      ? 'listings'
      : (searchScopeFromRouteParams(params) ??
        (pathname.startsWith('/search') ? 'all' : searchScopeFromPath(pathname)))

  return (
    <UnifiedSearchScreen
      query={searchQueryFromRouteParams(params)}
      scope={scope}
      mode={mode}
      filters={listingBrowseFiltersFromRouteParams(params)}
    />
  )
}
