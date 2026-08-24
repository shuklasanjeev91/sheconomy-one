import { useLoader } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { GroupScreen } from '~/community/screens/GroupScreen'
import { groupSeoLoader } from '~/lib/seo/entity-seo-loaders'

export async function loader(props: Parameters<typeof groupSeoLoader>[0]) {
  return groupSeoLoader(props)
}

export default function GroupPage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)
  return (
    <AppErrorBoundary scope="Group">
      <GroupScreen />
    </AppErrorBoundary>
  )
}
