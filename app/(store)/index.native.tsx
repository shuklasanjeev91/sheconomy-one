import { useNativeLoader } from '~/hooks/useNativeLoader'
import { CACHE_KEYS } from '~/lib/bootstrap/app-prefetch'
import { homeLoader, HomeScreen } from '~/commerce/screens/HomeScreen'

export { homeLoader as loader }

/**
 * Native entry for store home — same shared `HomeScreen` as web/SSR.
 * Only the data loader differs (native cache vs SSR).
 */
export default function StoreHomeScreen() {
  const { data: result, loading, error: loadError } = useNativeLoader(homeLoader, {
    cacheKey: CACHE_KEYS.home,
  })

  return (
    <HomeScreen
      data={result?.data ?? null}
      error={result?.error ?? loadError ?? null}
      loading={loading}
    />
  )
}
