import { useNativeLoader } from '~/hooks/useNativeLoader'
import { CACHE_KEYS } from '~/lib/bootstrap/app-prefetch'
import { homeLoader, HomeScreen } from '~/commerce/screens/HomeScreen'

export { homeLoader as loader }

/** Native store home — native loader + shared cross-platform HomeScreen. */
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
