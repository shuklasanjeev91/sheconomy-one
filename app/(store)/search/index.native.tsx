import { useGlobalSearchParams } from 'one'

import { parseListingBrowseFilters } from '~/commerce/lib/filters'
import { SearchScreen } from '~/commerce/screens/SearchScreen'

export default function SearchPage() {
  const params = useGlobalSearchParams()
  const query =
    typeof params.q === 'string' ? params.q : Array.isArray(params.q) ? (params.q[0] ?? '') : ''
  const search = query ? `?q=${encodeURIComponent(query)}` : ''
  const urlParams = new URLSearchParams(search)

  return (
    <SearchScreen
      query={urlParams.get('q') ?? ''}
      filters={parseListingBrowseFilters(urlParams)}
    />
  )
}
