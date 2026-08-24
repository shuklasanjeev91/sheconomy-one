import { useLoader } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { JobDetailScreen } from '~/community/screens/JobDetailScreen'
import { jobSeoLoader } from '~/lib/seo/entity-seo-loaders'

export async function loader(props: Parameters<typeof jobSeoLoader>[0]) {
  return jobSeoLoader(props)
}

export default function JobPage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)
  return (
    <AppErrorBoundary scope="Job">
      <JobDetailScreen />
    </AppErrorBoundary>
  )
}
