import { useLoader } from 'one'

import { homeLoader, HomeScreenView } from '~/commerce/screens/home-screen.shared'

export const loader = homeLoader

export default function StoreHomePage() {
  const { data, error } = useLoader(loader)

  return <HomeScreenView data={data ?? null} error={error ?? null} />
}
