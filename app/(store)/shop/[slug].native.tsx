import { useCallback } from 'react'
import { useParams } from 'one'

import { ShopScreen } from '~/commerce/screens/ShopScreen'
import { shopLoader } from '~/commerce/lib/shop-loader'
import { useNativeLoader } from '~/hooks/useNativeLoader'

export default function ShopNativePage() {
  const { slug } = useParams<{ slug: string }>()
  const loader = useCallback(
    () => shopLoader({ params: { slug: slug ?? '' }, path: `/shop/${slug ?? ''}` }),
    [slug],
  )
  const { data, loading } = useNativeLoader(loader, {
    cacheKey: slug ? `route:shop:${slug}` : undefined,
  })

  return (
    <ShopScreen
      initial={data}
      awaitingInitial={Boolean(slug) && loading && !data?.data && !data?.error}
    />
  )
}
