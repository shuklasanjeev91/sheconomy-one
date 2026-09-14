import { useLoader, useLocalSearchParams, useParams, usePathname } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { MeetingLobbyScreen } from '~/co-work/screens/MeetingLobbyScreen'
import { meetingSeoLoader } from '~/lib/seo/entity-seo-loaders'

function readRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function useMeetingCode(): string {
  const routeParams = useParams<{ code?: string | string[] }>()
  const localParams = useLocalSearchParams<{ code?: string | string[] }>()
  const pathname = usePathname() ?? ''
  const fromParams =
    readRouteParam(routeParams.code) || readRouteParam(localParams.code)
  if (fromParams) return fromParams
  const match = pathname.match(/\/co-work\/meeting\/([^/?#]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

export async function loader(props: Parameters<typeof meetingSeoLoader>[0]) {
  return meetingSeoLoader(props)
}

/** Server-rendered lobby so social crawlers receive meeting-specific Open Graph tags. */
export default function CoWorkMeetingLobbyRoute() {
  const data = useLoader(loader)
  const code = useMeetingCode()
  usePageSeo(data?.seo ?? null)

  return (
    <AppErrorBoundary scope="CoWorkMeeting">
      <MeetingLobbyScreen code={code} />
    </AppErrorBoundary>
  )
}
