import { useNativeLoader } from '~/hooks/useNativeLoader'
import { homeLoader, HomeScreen } from '~/commerce/screens/HomeScreen'

/** Keep route export for One preload/SSR when available. */
export async function loader() {
  return homeLoader()
}

/**
 * Web store home.
 * App uses `defaultRenderMode: 'spa'`, so `useLoader` often returns undefined for `/`
 * (loader JS missing or not yet hydrated). Load on the client like native.
 */
export default function StoreHomePage() {
  const { data: result, loading, error: loadError } = useNativeLoader(homeLoader)

  return (
    <HomeScreen
      data={result?.data ?? null}
      error={result?.error ?? loadError ?? null}
      loading={loading}
    />
  )
}
