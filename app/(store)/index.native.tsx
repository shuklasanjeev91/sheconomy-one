import { useNativeLoader } from '~/hooks/useNativeLoader'
import { homeLoader, HomeScreenView } from '~/commerce/screens/home-screen.shared'

export { homeLoader as loader }

export default function StoreHomeScreen() {
  const { data: result, loading, error: loadError } = useNativeLoader(homeLoader)

  return (
    <HomeScreenView
      data={result?.data ?? null}
      error={result?.error ?? loadError ?? null}
      loading={loading}
    />
  )
}
