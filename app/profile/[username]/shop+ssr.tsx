import { useLoader } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { ProfileShopScreen } from '~/community/screens/ProfileShopScreen'
import { profileShopSeoLoader } from '~/lib/seo/entity-seo-loaders'

export async function loader(props: Parameters<typeof profileShopSeoLoader>[0]) {
  return profileShopSeoLoader(props)
}

export default function ProfileShopPage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)
  return (
    <AppErrorBoundary scope="ProfileShop">
      <ProfileShopScreen />
    </AppErrorBoundary>
  )
}
