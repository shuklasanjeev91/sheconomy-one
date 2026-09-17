import { useLocalSearchParams, useParams, usePathname } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { MeetingLobbyScreen } from '~/co-work/screens/MeetingLobbyScreen'

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
  const match = pathname.match(/\/co-?work\/meeting\/([^/?#]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

/** Alias route for /cowork/meeting/:code (same lobby as /co-work/...). */
export default function CoworkMeetingLobbyRoute() {
  const code = useMeetingCode()
  return (
    <AppErrorBoundary scope="CoWorkMeeting">
      <MeetingLobbyScreen code={code} />
    </AppErrorBoundary>
  )
}
