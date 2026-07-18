import { useGlobalSearchParams, useLoader } from 'one'

import { categoryLoader } from '~/commerce/lib/category-loader'
import { listingBrowseFiltersFromRouteParams } from '~/commerce/lib/filters'
import { CategoryScreen } from '~/commerce/screens/CategoryScreen'

export async function loader(props: Parameters<typeof categoryLoader>[0]) {
  return categoryLoader(props)
}

export default function CategoryPage() {
  const params = useGlobalSearchParams()
  const filters = listingBrowseFiltersFromRouteParams(params, { exclude: ['slug'] })
  const initial = useLoader(loader)

  return <CategoryScreen filters={filters} initial={initial} />
}
