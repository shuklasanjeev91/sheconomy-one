import { useGlobalSearchParams } from 'one'

import {
  listingBrowseFiltersFromRouteParams,
  searchQueryFromRouteParams,
} from '~/commerce/lib/filters'
import { SearchScreen } from '~/commerce/screens/SearchScreen'

export default function SearchPage() {
  const params = useGlobalSearchParams()

  return (
    <SearchScreen
      query={searchQueryFromRouteParams(params)}
      filters={listingBrowseFiltersFromRouteParams(params)}
    />
  )
}
