import { useGlobalSearchParams } from 'one'

import { listingBrowseFiltersFromRouteParams } from '~/commerce/lib/filters'
import { CategoryScreen } from '~/commerce/screens/CategoryScreen'

export default function CategoryPage() {
  const params = useGlobalSearchParams()
  const filters = listingBrowseFiltersFromRouteParams(params, { exclude: ['slug'] })

  return <CategoryScreen filters={filters} />
}
