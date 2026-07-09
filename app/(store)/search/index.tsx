import { useLoader } from 'one'

import { parseListingBrowseFilters } from '~/commerce/lib/filters'
import { SearchScreen } from '~/commerce/screens/SearchScreen'

export async function loader({ search }: { search?: string }) {
  const params = new URLSearchParams(search ?? '')
  return {
    query: params.get('q') ?? '',
    filters: parseListingBrowseFilters(params),
  }
}

export default function SearchPage() {
  const { query, filters } = useLoader(loader)
  return <SearchScreen query={query} filters={filters} />
}