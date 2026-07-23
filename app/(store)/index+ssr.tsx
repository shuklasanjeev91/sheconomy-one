import { useLoader } from 'one'

import { homeLoader, HomeScreen } from '~/commerce/screens/HomeScreen'

/** SSR loader for storefront home. */
export async function loader() {
  return homeLoader()
}

export default function StoreHomePage() {
  const result = useLoader(loader)

  return (
    <HomeScreen
      data={result?.data ?? null}
      error={result?.error ?? null}
      loading={false}
    />
  )
}
