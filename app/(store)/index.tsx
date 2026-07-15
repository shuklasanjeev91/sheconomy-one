import { useLoader } from 'one'

import { homeLoader, HomeScreen } from '~/commerce/screens/HomeScreen'

export const loader = homeLoader

/** Web store home — SSR loader + shared cross-platform HomeScreen. */
export default function StoreHomePage() {
  const { data, error } = useLoader(loader)

  return <HomeScreen data={data ?? null} error={error ?? null} />
}
