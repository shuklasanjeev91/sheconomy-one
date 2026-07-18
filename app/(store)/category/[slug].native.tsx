import { useGlobalSearchParams, useParams } from 'one'

import { categoryLoader } from '~/commerce/lib/category-loader'
import { listingBrowseFiltersFromRouteParams } from '~/commerce/lib/filters'
import { CategoryScreen } from '~/commerce/screens/CategoryScreen'
import { useNativeLoader } from '~/hooks/useNativeLoader'

export default function CategoryNativePage() {
  const { slug } = useParams<{ slug: string }>()
  const params = useGlobalSearchParams()
  const filters = listingBrowseFiltersFromRouteParams(params, { exclude: ['slug'] })
  const { data } = useNativeLoader(
    () =>
      categoryLoader({
        params: { slug: slug ?? '' },
        path: `/category/${slug ?? ''}`,
        search: new URLSearchParams(
          Object.entries(params).flatMap(([key, value]) => {
            if (key === 'slug' || value == null) return []
            const values = Array.isArray(value) ? value : [value]
            return values.map((v) => [key, String(v)] as [string, string])
          }),
        ).toString(),
      }),
    { cacheKey: slug ? `route:category:${slug}` : undefined },
  )

  return <CategoryScreen filters={filters} initial={data} />
}
