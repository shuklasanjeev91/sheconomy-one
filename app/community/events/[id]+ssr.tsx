import { useLoader } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { EventDetailScreen } from '~/community/screens/EventDetailScreen'
import { eventSeoLoader } from '~/lib/seo/entity-seo-loaders'

export async function loader(props: Parameters<typeof eventSeoLoader>[0]) {
  return eventSeoLoader(props)
}

export default function EventPage() {
  const data = useLoader(loader)
  usePageSeo(data?.seo ?? null)
  return (
    <AppErrorBoundary scope="Event">
      <EventDetailScreen />
    </AppErrorBoundary>
  )
}
