import { useLoader } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { CompanyPageScreen } from '~/community/screens/CompanyPageScreen'
import { companySeoLoader } from '~/lib/seo/entity-seo-loaders'

export async function loader(props: Parameters<typeof companySeoLoader>[0]) {
  return companySeoLoader(props)
}

export default function CompanyPage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)
  return (
    <AppErrorBoundary scope="Company">
      <CompanyPageScreen />
    </AppErrorBoundary>
  )
}
