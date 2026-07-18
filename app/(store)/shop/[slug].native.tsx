import { useParams } from 'one'

import { ShopScreen } from '~/commerce/screens/ShopScreen'
import { shopLoader } from '~/commerce/lib/shop-loader'
import { useNativeLoader } from '~/hooks/useNativeLoader'

export default function ShopNativePage() {
  const { slug } = useParams<{ slug: string }>()
  const { data } = useNativeLoader(
    () => shopLoader({ params: { slug: slug ?? '' }, path: `/shop/${slug ?? ''}` }),
    { cacheKey: slug ? `route:shop:${slug}` : undefined },
  )
  return <ShopScreen initial={data} />
}
