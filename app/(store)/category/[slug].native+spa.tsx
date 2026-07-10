import { useGlobalSearchParams } from 'one'

import { parseListingBrowseFilters } from '~/commerce/lib/filters'
import { CategoryScreen } from '~/commerce/screens/CategoryScreen'

export default function CategoryPage() {
  const params = useGlobalSearchParams()
  const searchParts = Object.entries(params).flatMap(([key, value]) => {
    if (value == null) return []
    const values = Array.isArray(value) ? value : [value]
    return values.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
  })
  const urlParams = new URLSearchParams(searchParts.join('&'))

  return <CategoryScreen filters={parseListingBrowseFilters(urlParams)} />
}
