import { useLoader } from 'one'

import { parseListingBrowseFilters } from '~/commerce/lib/filters'
import { CategoryScreen } from '~/commerce/screens/CategoryScreen'

export async function loader({ search }: { search?: string }) {
  const params = new URLSearchParams(search ?? '')
  return { filters: parseListingBrowseFilters(params) }
}

export default function CategoryPage() {
  const { filters } = useLoader(loader)
  return <CategoryScreen filters={filters} />
}