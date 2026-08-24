import { useLoader } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { ProgramScreen } from '~/class/screens/ProgramScreen'
import { programSeoLoader } from '~/lib/seo/entity-seo-loaders'

export async function loader(props: Parameters<typeof programSeoLoader>[0]) {
  return programSeoLoader(props)
}

export default function ProgramPage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)
  return (
    <AppErrorBoundary scope="Program">
      <ProgramScreen />
    </AppErrorBoundary>
  )
}
